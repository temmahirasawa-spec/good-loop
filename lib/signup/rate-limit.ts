import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashClientIp } from "@/lib/ai-check/rate-limit";

/**
 * 新規登録のレート制限（supabase/0014、2026-08-24 天真の決定）。
 *
 * 新規登録は**認証なしで誰でも叩ける**。歯止めが無いと大量の契約先が作られ、
 * そのぶんトライアル中のAIクチコミ生成（Anthropic への課金）が弊社負担で走る。
 *
 * IPのハッシュ化は AI視認性チェッカーと同じ仕組みを使い回す（`hashClientIp`）。
 * **生のIPアドレスは保存も記録もしない。**
 *
 * ⚠ Supabase に繋がらないときは「拒否」に倒す（fail-closed）。
 *   上限が効かないまま登録を通すと、費用の歯止めが無くなるため。
 *   AI視認性チェッカーのレート制限と同じ方針。
 */

/** 1つの回線が1時間に登録できる数 */
export const HOURLY_SIGNUP_LIMIT = 3;
/** 1つの回線が1日に登録できる数 */
export const DAILY_SIGNUP_LIMIT = 10;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 古い行を消す確率（1リクエストあたり）。cron を増やさずに掃除する */
const CLEANUP_PROBABILITY = 0.02;
const RETENTION_DAYS = 7;

export type SignupRateVerdict =
  | { allowed: true }
  /** そのIPの上限に達した */
  | { allowed: false; reason: "per_ip" }
  /** 上限を数えられなかった。安全側に倒して断る */
  | { allowed: false; reason: "unavailable" };

export { hashClientIp };

export async function checkSignupRateLimit(
  supabase: SupabaseClient,
  ipHash: string,
  now: Date = new Date(),
): Promise<SignupRateVerdict> {
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString();
  const hourAgo = new Date(now.getTime() - HOUR_MS).toISOString();

  const { data, error } = await supabase
    .from("signup_attempts")
    .select("created_at")
    .eq("ip_hash", ipHash)
    .gte("created_at", dayAgo)
    .returns<{ created_at: string }[]>();

  // 数えられなかったら通さない（fail-closed）
  if (error || !data) return { allowed: false, reason: "unavailable" };

  if (data.length >= DAILY_SIGNUP_LIMIT) return { allowed: false, reason: "per_ip" };
  const inLastHour = data.filter((r) => r.created_at >= hourAgo).length;
  if (inLastHour >= HOURLY_SIGNUP_LIMIT) return { allowed: false, reason: "per_ip" };

  return { allowed: true };
}

/** 試行を記録する。成否どちらも残す（失敗ばかり続く相手は総当たりの可能性がある） */
export async function recordSignupAttempt(
  supabase: SupabaseClient,
  ipHash: string,
  succeeded: boolean,
): Promise<void> {
  await supabase.from("signup_attempts").insert({ ip_hash: ipHash, succeeded });

  // たまに古い行を掃除する
  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
    await supabase.from("signup_attempts").delete().lt("created_at", cutoff);
  }
}
