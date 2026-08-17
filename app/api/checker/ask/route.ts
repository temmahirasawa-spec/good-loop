import { NextResponse } from "next/server";
import { MissingApiKeyError, createAnthropicClient } from "@/lib/ai-check/anthropic";
import { askAi, trimExcerpt } from "@/lib/ai-check/ask";
import {
  CACHE_TTL_HOURS,
  readAnswerCache,
  readJudgementCache,
  writeAnswerCache,
  writeJudgementCache,
} from "@/lib/ai-check/cache";
import { judgeMention, type Judgement } from "@/lib/ai-check/judge";
import {
  MissingIpSaltError,
  checkRateLimit,
  hashClientIp,
  maybeCleanup,
  recordRequest,
} from "@/lib/ai-check/rate-limit";
import {
  MAX_QUESTION_LENGTH,
  MAX_STORE_NAME_LENGTH,
  sanitizeUserText,
} from "@/lib/ai-check/sanitize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * AI視認性チェッカーの計測1問ぶん（docs/plans/ai-visibility-checker.md 6-2 / 11章）。
 *
 * ① AIにWeb検索付きで質問する（**店名は渡さない**。渡すと結果が誘導され計測にならない）
 * ② 返ってきた回答テキストに対して、別のAI呼び出しで店名の言及を判定する
 *
 * クライアントは質問の数だけこれを並列に呼ぶ。1問＝1リクエストにしているのは、
 * 3問を1リクエストで回すとVercelの関数の実行時間に引っかかるため。
 *
 * ── 処理の順番（費用の防御）──────────────────────────────
 *   1. 入力の検査・洗浄
 *   2. キャッシュを見る  … 当たれば上限を消費せず即返す（AIを呼んでいない＝無料）
 *   3. レート制限        … 数えられなければ**断る**（fail-closed）
 *   4. 利用を記録
 *   5. AIを呼ぶ → キャッシュに保存
 *
 * 1問が落ちても他の問でレポートを出せるよう、失敗はステータスコードで返し、
 * 画面側でその問だけを「取得できませんでした」にする。
 */

// Edge ではなく Node.js で動かす（Anthropic SDK と server-only を使うため）
export const runtime = "nodejs";

/**
 * Web検索を伴う応答は1問あたり30〜90秒かかりうる（実測は約9秒）。
 * 300秒は全プランで通る上限（既定値）。
 * SDK側は ask 120秒 ＋ judge 30秒、再試行なし（lib/ai-check/anthropic.ts）。
 */
export const maxDuration = 300;

type Body = {
  question: string;
  storeName: string;
};

type Sanitized = { question: string; storeName: string };

function sanitizeBody(body: unknown): Sanitized | null {
  if (typeof body !== "object" || body === null) return null;
  const value = body as Partial<Body>;

  const question = sanitizeUserText(value.question, MAX_QUESTION_LENGTH);
  const storeName = sanitizeUserText(value.storeName, MAX_STORE_NAME_LENGTH);
  if (!question.ok || !storeName.ok) return null;

  return { question: question.value, storeName: storeName.value };
}

function resultResponse(judgement: Judgement, answerText: string) {
  return NextResponse.json({
    mentioned: judgement.mentioned,
    position: judgement.position,
    matchedText: judgement.matchedText,
    stores: judgement.stores,
    excerpt: trimExcerpt(answerText),
  });
}

export async function POST(request: Request) {
  // ── 1. 入力 ────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  const input = sanitizeBody(body);
  if (!input) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  let ipHash;
  try {
    ipHash = hashClientIp(request);
  } catch (error) {
    if (error instanceof MissingIpSaltError) {
      return NextResponse.json({ error: "AI_CHECK_IP_SALT is not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "failed to identify client" }, { status: 500 });
  }

  const supabase = createSupabaseAdminClient();

  // ── 2. キャッシュ（当たれば上限を消費しない）───────────
  const cachedAnswer = await readAnswerCache(supabase, input.question);
  if (cachedAnswer) {
    const cachedJudgement = await readJudgementCache(
      supabase,
      cachedAnswer.text,
      input.storeName
    );
    if (cachedJudgement) {
      await recordRequest(supabase, ipHash, true);
      return resultResponse(cachedJudgement, cachedAnswer.text);
    }
  }

  // ── 3. レート制限（数えられなければ断る）────────────────
  const verdict = await checkRateLimit(supabase, ipHash);
  if (!verdict.allowed) {
    const status = verdict.reason === "unavailable" ? 503 : 429;
    return NextResponse.json({ error: "rate limited", reason: verdict.reason }, { status });
  }

  // ── 4. 記録 ────────────────────────────────────────────
  await recordRequest(supabase, ipHash, false);
  await maybeCleanup(supabase, CACHE_TTL_HOURS);

  let client;
  try {
    client = createAnthropicClient();
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      // 鍵が無いのは設定の問題。ビルドは通り、叩いたときだけここに落ちる
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "failed to create anthropic client" }, { status: 500 });
  }

  // ── 5. AIを呼ぶ ────────────────────────────────────────
  let answerText = cachedAnswer?.text ?? null;
  if (answerText === null) {
    try {
      const answer = await askAi(client, input.question);
      answerText = answer.text;
      await writeAnswerCache(supabase, input.question, answer);
    } catch {
      // タイムアウト・レート制限・空応答。この問だけ落とし、他の問は生かす
      return NextResponse.json({ error: "failed to ask ai" }, { status: 502 });
    }
  }

  // judgeMention は投げない（失敗しても文字列一致にフォールバックする）
  const judgement = await judgeMention(client, answerText, input.storeName);
  await writeJudgementCache(supabase, answerText, input.storeName, judgement);

  return resultResponse(judgement, answerText);
}
