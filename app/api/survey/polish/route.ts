import Anthropic from "@anthropic-ai/sdk";
import { hashClientIp } from "@/lib/ai-check/rate-limit";
import { GUARD_WORDS } from "@/lib/demo/fact-model";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { guardPolished, MAX_INPUT_CHARS } from "@/lib/survey/polish-guard";
import {
  POLISH_MAX_TOKENS,
  POLISH_MODEL,
  POLISH_SYSTEM_PROMPT,
  buildPolishUserPrompt,
} from "@/lib/survey/polish-prompt";
import { checkSurveyLimit, recordSurveyRequest } from "@/lib/survey/request-limit";

/**
 * 「整える」の API（docs/specs/survey-v4.md §6）。v5 の「つなげる」は、欄ごとにこれを呼ぶ（survey-v5.md §4）。
 *
 * **受け取るのは本文の文字列だけ。** ★・話題タグ・店名・メニュー名は受け取らない
 * （body の型に無いので、構造的に混入できない）。
 *
 * **検査はサーバー側で行う。** ブラウザ側だけの検証は迂回できる飾りになるため
 * （strategy-2026-09-13 §4-2 #4）。検査に落ちたら `{ text: null }` を返し、
 * 画面には何も出さない（エラー文言も出さない）。画面は本人の言葉のまま（句点だけ足す）でつなげる。
 *
 * **DBには回答を書き込まない。** 回答の保存は /api/survey/v5/responses。
 *
 * 回数の上限は Supabase で数える（supabase/0019 の survey_requests、2026-10-01 に本番化）。
 * 数えられないとき（表がまだ無い・塩が無い・Supabase に繋がらない）は**断る**。
 * 上限が効かないまま AI を呼ぶと、請求額が止まらなくなるため（lib/ai-check/rate-limit.ts と同じ方針）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 似すぎ検出の比較相手。**同一店舗の、他のお客様が実際に送った本文**がここに入る想定。
 *
 * ⚠ いまは**常に空**にしてある。v5 で AI が足せるのは許可した助詞と句読点だけなので、
 *   似た文面になる余地がほとんど無い（strategy-2026-09-13 §5-4 の心配は全文生成のもの）。
 *   使うなら survey_responses から同じ店の直近20件を読む。
 *   自分が今さっき出した候補を貯めると、**同じ人の2回目が必ず似すぎで落ちる**
 *   （同じ入力から出る候補は文字の重なりが大きいのが当たり前。2026-09-13 のレビューで再現）。
 */
const recentBodies: string[] = [];

/** モデルがコードフェンスや前置きを付けてもJSONを取り出す */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

type Body = { body?: string };

/** 検査に落ちたときも 200 で返す。画面は「何も出さない」だけで、エラーを見せない */
function nothing(reason: string) {
  return Response.json({ text: null, reason }, { status: 200 });
}

export async function POST(req: Request) {
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return nothing("bad-request");
  }

  const input = (payload.body ?? "").trim();
  if (!input) return nothing("empty-input");
  if (Array.from(input).length > MAX_INPUT_CHARS) return nothing("too-long-input");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return nothing("no-key");

  let ipHash: string;
  try {
    ipHash = hashClientIp(req);
  } catch {
    return nothing("limit-unavailable");
  }
  const supabase = createSupabaseAdminClient();
  const limit = await checkSurveyLimit(supabase, ipHash, "polish");
  if (!limit.allowed) return nothing(limit.reason === "unavailable" ? "limit-unavailable" : "rate-limited");
  // AI を呼ぶ前に記録する（呼んだあとだと、失敗や時間切れのぶんが数えられず上限が甘くなる）
  await recordSurveyRequest(supabase, ipHash, "polish");

  let raw: string;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: POLISH_MODEL,
      max_tokens: POLISH_MAX_TOKENS,
      system: POLISH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPolishUserPrompt(input) }],
    });
    // 途中で切れた応答は、壊れたJSONを無理に読まずに捨てる
    if (message.stop_reason === "max_tokens") return nothing("truncated");
    raw = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  } catch {
    return nothing("api-error");
  }

  let candidate: string;
  try {
    const parsed = extractJson(raw) as { text?: unknown };
    candidate = typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return nothing("bad-json");
  }

  const verdict = guardPolished(input, candidate, GUARD_WORDS, recentBodies);
  if (!verdict.ok) return nothing(verdict.reason);

  // ⚠ ここで候補を recentBodies に貯めない（上のコメント参照）
  return Response.json({ text: verdict.text }, { status: 200 });
}
