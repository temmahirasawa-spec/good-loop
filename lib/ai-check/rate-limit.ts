import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * IPアドレス単位＋全体のレート制限（docs/plans/ai-visibility-checker.md 9-6）。
 *
 * このツールは認証なしで叩ける。1回叩かれるたびに Anthropic への課金が発生するので、
 * **これが唯一の費用の歯止め**になる。
 *
 * ⚠ Supabase に繋がらないときは「拒否」に倒す（fail-closed）。
 *   上限が効かないまま動かすと、請求額が止まらなくなるため。
 *   キャッシュ（cache.ts）とは逆の方針なので注意。
 */

/** 1回の診断でこのエンドポイントを呼ぶ回数（質問の数） */
export const REQUESTS_PER_DIAGNOSIS = 3;

/** 1つのIPが1時間にできる診断の回数 */
export const HOURLY_DIAGNOSIS_LIMIT = 5;
/** 1つのIPが1日にできる診断の回数 */
export const DAILY_DIAGNOSIS_LIMIT = 20;
/**
 * 全体で1日にできる診断の回数。
 * IP単位の制限だけでは、IPを変えられると請求額が止まらない。これが本当の上限。
 * 1診断あたり約20円（うちWeb検索が約14円）なので、300診断で1日あたり約6,000円が上限。
 */
export const GLOBAL_DAILY_DIAGNOSIS_LIMIT = 300;

const HOURLY_REQUEST_LIMIT = HOURLY_DIAGNOSIS_LIMIT * REQUESTS_PER_DIAGNOSIS;
const DAILY_REQUEST_LIMIT = DAILY_DIAGNOSIS_LIMIT * REQUESTS_PER_DIAGNOSIS;
const GLOBAL_DAILY_REQUEST_LIMIT = GLOBAL_DAILY_DIAGNOSIS_LIMIT * REQUESTS_PER_DIAGNOSIS;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 古い行を消す確率（1リクエストあたり）。cron を増やさずに掃除する */
const CLEANUP_PROBABILITY = 0.01;
/** 利用記録を残す期間 */
const REQUEST_RETENTION_DAYS = 2;

export class MissingIpSaltError extends Error {
  constructor() {
    super("AI_CHECK_IP_SALT is not configured");
    this.name = "MissingIpSaltError";
  }
}

/**
 * リクエスト元のIPをハッシュ化する。**生のIPは保存も記録もしない。**
 *
 * Vercel は `x-forwarded-for` を必ず付ける。手前にプロキシが複数ある場合は
 * カンマ区切りで並ぶので、いちばん左（＝実際のクライアント）を採る。
 */
export function hashClientIp(request: Request): string {
  const salt = process.env.AI_CHECK_IP_SALT;
  if (!salt) throw new MissingIpSaltError();

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();

  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export type RateLimitVerdict =
  | { allowed: true }
  /** そのIPの上限に達した */
  | { allowed: false; reason: "per_ip" }
  /** 全体の1日上限に達した */
  | { allowed: false; reason: "global" }
  /** 上限を数えられなかった。安全側に倒して断る */
  | { allowed: false; reason: "unavailable" };

export async function checkRateLimit(
  supabase: SupabaseClient,
  ipHash: string
): Promise<RateLimitVerdict> {
  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS).toISOString();
  const hourAgo = now - HOUR_MS;

  try {
    const [mine, global] = await Promise.all([
      // このIPの直近24時間ぶん。1時間ぶんはこの結果から数えるので、問い合わせは1回で済む
      supabase
        .from("ai_check_requests")
        .select("created_at")
        .eq("ip_hash", ipHash)
        .eq("cache_hit", false)
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(DAILY_REQUEST_LIMIT + 1),
      // 全体の直近24時間ぶんの件数
      supabase
        .from("ai_check_requests")
        .select("*", { count: "exact", head: true })
        .eq("cache_hit", false)
        .gte("created_at", dayAgo),
    ]);

    if (mine.error || global.error) return { allowed: false, reason: "unavailable" };

    const rows = mine.data ?? [];
    if (rows.length >= DAILY_REQUEST_LIMIT) return { allowed: false, reason: "per_ip" };

    const withinHour = rows.filter((row) => new Date(row.created_at).getTime() >= hourAgo).length;
    if (withinHour >= HOURLY_REQUEST_LIMIT) return { allowed: false, reason: "per_ip" };

    if ((global.count ?? 0) >= GLOBAL_DAILY_REQUEST_LIMIT) {
      return { allowed: false, reason: "global" };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}

/** 利用を記録する。失敗しても診断は止めない（記録漏れより画面が止まるほうが困る） */
export async function recordRequest(
  supabase: SupabaseClient,
  ipHash: string,
  cacheHit: boolean
): Promise<void> {
  await supabase
    .from("ai_check_requests")
    .insert({ ip_hash: ipHash, cache_hit: cacheHit })
    .then(
      () => {},
      () => {}
    );
}

/**
 * たまに古い行を消す。cron を増やさずに表が太り続けるのを防ぐ。
 * 失敗しても何もしない。
 */
export async function maybeCleanup(supabase: SupabaseClient, cacheTtlHours: number): Promise<void> {
  if (Math.random() >= CLEANUP_PROBABILITY) return;

  const requestCutoff = new Date(Date.now() - REQUEST_RETENTION_DAYS * DAY_MS).toISOString();
  const cacheCutoff = new Date(Date.now() - cacheTtlHours * 2 * HOUR_MS).toISOString();

  await Promise.all([
    supabase.from("ai_check_requests").delete().lt("created_at", requestCutoff),
    supabase.from("ai_check_cache").delete().lt("created_at", cacheCutoff),
  ]).then(
    () => {},
    () => {}
  );
}
