import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASK_MODEL, ASK_PROMPT_VERSION, JUDGE_MODEL, JUDGE_PROMPT_VERSION } from "./anthropic";
import type { Judgement } from "./judge";
import { normalizeName } from "./match";

/**
 * AI応答のキャッシュ（docs/plans/ai-visibility-checker.md 11章）。
 *
 * **2段に分けているのが肝。**
 *   1段目 answer    質問文 → AIの回答（Web検索込み）
 *                   質問文には店名が入らない（誘導を防ぐため）ので、
 *                   **同じエリア×ジャンルなら全利用者で共有できる。** 費用の大半はここ。
 *   2段目 judgement 回答 × 店名 → 言及判定
 *                   完全な再訪のときだけ効く。単体では安いが、当たれば呼び出しがゼロになる。
 *
 * ⚠ Supabase に繋がらないときは「キャッシュ無し」として素通りする（fail-open）。
 *   外れてもAIを1回余分に呼ぶだけ。レート制限（rate-limit.ts）とは逆の方針。
 */

/** キャッシュの有効期間。AIの回答は日々変わるので長く持ちすぎない */
export const CACHE_TTL_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/**
 * キーにモデルとプロンプト版を含める。どちらかを変えたら自動で全部無効になる。
 * 連結は JSON にする（区切り文字が中身に現れて別のキーと衝突するのを防ぐため）。
 */
function buildKey(kind: string, parts: string[]): string {
  return createHash("sha256").update(JSON.stringify([kind, ...parts])).digest("hex");
}

function freshnessCutoff(): string {
  return new Date(Date.now() - CACHE_TTL_HOURS * HOUR_MS).toISOString();
}

async function read<T>(supabase: SupabaseClient, cacheKey: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from("ai_check_cache")
      .select("payload")
      .eq("cache_key", cacheKey)
      .gte("created_at", freshnessCutoff())
      .maybeSingle();

    if (error || !data) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

async function write(
  supabase: SupabaseClient,
  cacheKey: string,
  kind: "answer" | "judgement",
  payload: unknown
): Promise<void> {
  // 期限切れの行を上書きしたいので upsert。created_at も now に更新する
  await supabase
    .from("ai_check_cache")
    .upsert(
      { cache_key: cacheKey, kind, payload, created_at: new Date().toISOString() },
      { onConflict: "cache_key" }
    )
    .then(
      () => {},
      () => {}
    );
}

// ── 1段目: 質問 → 回答 ─────────────────────────────────────

export type CachedAnswer = { text: string; searchCount: number };

function answerKey(question: string): string {
  return buildKey("answer", [question.trim(), ASK_MODEL, ASK_PROMPT_VERSION]);
}

export function readAnswerCache(
  supabase: SupabaseClient,
  question: string
): Promise<CachedAnswer | null> {
  return read<CachedAnswer>(supabase, answerKey(question));
}

export function writeAnswerCache(
  supabase: SupabaseClient,
  question: string,
  answer: CachedAnswer
): Promise<void> {
  return write(supabase, answerKey(question), "answer", answer);
}

// ── 2段目: 回答 × 店名 → 判定 ───────────────────────────────

function judgementKey(answerText: string, storeName: string): string {
  const answerHash = createHash("sha256").update(answerText).digest("hex");
  return buildKey("judgement", [
    answerHash,
    normalizeName(storeName),
    JUDGE_MODEL,
    JUDGE_PROMPT_VERSION,
  ]);
}

export function readJudgementCache(
  supabase: SupabaseClient,
  answerText: string,
  storeName: string
): Promise<Judgement | null> {
  return read<Judgement>(supabase, judgementKey(answerText, storeName));
}

export function writeJudgementCache(
  supabase: SupabaseClient,
  answerText: string,
  storeName: string,
  judgement: Judgement
): Promise<void> {
  return write(supabase, judgementKey(answerText, storeName), "judgement", judgement);
}
