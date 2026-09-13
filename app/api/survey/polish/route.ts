import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { GUARD_WORDS } from "@/lib/demo/fact-model";
import { guardPolished, MAX_INPUT_CHARS } from "@/lib/survey/polish-guard";
import {
  POLISH_MAX_TOKENS,
  POLISH_MODEL,
  POLISH_SYSTEM_PROMPT,
  buildPolishUserPrompt,
} from "@/lib/survey/polish-prompt";

/**
 * v4「文にする」の API（docs/specs/survey-v4.md §6）。
 *
 * **受け取るのは本文の文字列だけ。** ★・話題タグ・店名・メニュー名は受け取らない
 * （body の型に無いので、構造的に混入できない）。
 *
 * **検査はサーバー側で行う。** ブラウザ側だけの検証は迂回できる飾りになるため
 * （strategy-2026-09-13 §4-2 #4）。検査に落ちたら `{ text: null }` を返し、
 * 画面には何も出さない（エラー文言も出さない）。
 *
 * ⚠ **プロトタイプ（/demo/v4）専用。DBには一切書き込まない。**
 *   レート制限と似すぎ検出はプロセス内のメモリで数えている。
 *   **本番に載せるときは Supabase に移すこと**（lib/ai-check/rate-limit.ts と同じ形にする）。
 *   サーバーレスはプロセスが使い回されない場合があり、メモリの計数は上限として信用できない。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1つのIPが1時間に「文にする」を押せる回数 */
const HOURLY_LIMIT = 30;
/** 全体で1時間に許す回数。IPを変えられても止まるようにする本当の上限 */
const GLOBAL_HOURLY_LIMIT = 300;
const HOUR_MS = 60 * 60 * 1000;

/** ⚠ プロトタイプ専用のメモリ計数。本番は Supabase へ移す */
const hits: { at: number; ip: string }[] = [];
/** ⚠ プロトタイプ専用。本番は同一店舗の直近20件を survey_responses から読む */
const recentBodies: string[] = [];
const RECENT_KEEP = 20;

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

  if (rateLimited(clientIpHash(req))) return nothing("rate-limited");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return nothing("no-key");

  let raw: string;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: POLISH_MODEL,
      max_tokens: POLISH_MAX_TOKENS,
      system: POLISH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPolishUserPrompt(input) }],
    });
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

  recentBodies.push(verdict.text);
  while (recentBodies.length > RECENT_KEEP) recentBodies.shift();

  return Response.json({ text: verdict.text }, { status: 200 });
}
