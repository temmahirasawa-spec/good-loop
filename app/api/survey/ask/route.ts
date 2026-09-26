import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { ASK_MAX_INPUT_CHARS, guardQuestion } from "@/lib/survey/ask-guard";
import { ASK_MAX_TOKENS, ASK_MODEL, ASK_SYSTEM_PROMPT, buildAskUserPrompt } from "@/lib/survey/ask-prompt";

/**
 * v5「続きを聞く」の API（docs/specs/survey-v5.md §4）。
 *
 * **受け取るのは本文の文字列と、直前に出した問いだけ。** ★・話題タグ・店名・メニュー名は受け取らない
 * （body の型に無いので、構造的に混入できない）。
 *
 * **検査はサーバー側で行う。** 検査に落ちたら `{ question: null }` を返し、画面には何も出さない
 * （エラー文言も出さない）。
 *
 * ⚠ **プロトタイプ（/demo/v5）専用。DBには一切書き込まない。**
 *   レート制限はプロセス内のメモリで数えている。**本番に載せるときは Supabase に移すこと**
 *   （lib/ai-check/rate-limit.ts と同じ形にする）。サーバーレスはプロセスが使い回されない場合があり、
 *   メモリの計数は上限として信用できない。/api/survey/polish と同じ扱い。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 1つのIPが1時間に問いを頼める回数。
 * 店のWi-Fiでは来店客が同じIPを共有するので、1人ぶん（最大3問＋入れ替え）より十分大きくしてある
 */
const HOURLY_LIMIT = 60;
/** 全体で1時間に許す回数。IPを変えられても止まるようにする本当の上限 */
const GLOBAL_HOURLY_LIMIT = 600;
const HOUR_MS = 60 * 60 * 1000;
/** 1回の依頼でAIを呼ぶ回数の上限（検査に落ちたときの頼み直しを含む） */
const MAX_MODEL_CALLS = 2;
/** 直前に出した問いを、何件まで受け取るか */
const MAX_AVOID = 3;
const MAX_AVOID_CHARS = 60;

/** ⚠ プロトタイプ専用のメモリ計数。本番は Supabase へ移す */
const hits: { at: number; ip: string }[] = [];

function clientIpHash(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function rateLimited(ip: string): boolean {
  const cutoff = Date.now() - HOUR_MS;
  while (hits.length > 0 && hits[0].at < cutoff) hits.shift();
  if (hits.length >= GLOBAL_HOURLY_LIMIT) return true;
  if (hits.filter((h) => h.ip === ip).length >= HOURLY_LIMIT) return true;
  hits.push({ at: Date.now(), ip });
  return false;
}

/** モデルがコードフェンスや前置きを付けてもJSONを取り出す */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

type Body = { body?: unknown; avoid?: unknown };

/** 検査に落ちたときも 200 で返す。画面は「何も出さない」だけで、エラーを見せない */
function nothing(reason: string) {
  return Response.json({ question: null, reason }, { status: 200 });
}

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return nothing("bad-request");
  }

  const input = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!input) return nothing("empty-input");
  if (Array.from(input).length > ASK_MAX_INPUT_CHARS) return nothing("too-long-input");

  // 直前に出した問い。文字列以外・長すぎるものは黙って捨てる（本文以外の材料を持ち込ませない）
  const avoid = Array.isArray(payload.avoid)
    ? payload.avoid
        .filter((q): q is string => typeof q === "string" && q.trim() !== "" && Array.from(q).length <= MAX_AVOID_CHARS)
        .slice(-MAX_AVOID)
    : [];

  if (rateLimited(clientIpHash(req))) return nothing("rate-limited");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return nothing("no-key");
  const client = new Anthropic({ apiKey });

  // 検査に落ちたときだけ、1回だけ頼み直す（落とす基準は緩めない）。
  // 2026-09-26 の実測で、長い書きかけに対して3回に1回ほど問いが30字を超えて捨てられ、
  // 2つ目の問いが出ないことがあったため。頼み直しても1回0.1円ほど。
  let reason = "no-attempt";
  for (let attempt = 0; attempt < MAX_MODEL_CALLS; attempt++) {
    let raw: string;
    try {
      const message = await client.messages.create({
        model: ASK_MODEL,
        max_tokens: ASK_MAX_TOKENS,
        system: ASK_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildAskUserPrompt(input, avoid) }],
      });
      if (message.stop_reason === "max_tokens") {
        reason = "truncated";
        continue;
      }
      raw = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
    } catch {
      // 通信の失敗は頼み直さない（止まっているものを叩き続けない）
      return nothing("api-error");
    }

    let candidate: string;
    try {
      const parsed = extractJson(raw) as { question?: unknown };
      candidate = typeof parsed.question === "string" ? parsed.question : "";
    } catch {
      reason = "bad-json";
      continue;
    }

    const verdict = guardQuestion(input, candidate, avoid);
    if (verdict.ok) return Response.json({ question: verdict.question }, { status: 200 });
    reason = verdict.reason;
  }
  return nothing(reason);
}
