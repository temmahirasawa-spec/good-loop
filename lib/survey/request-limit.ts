import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 来店客が使う API の回数の上限（supabase/0019 の survey_requests）。
 *
 * 来店客はログインしないので、どちらの API も外から誰でも叩ける。
 *   - polish   … AIで「つなげる」（欄ごとに1回）。**1回ごとに Anthropic への課金が発生する**ので、これが費用の歯止め
 *   - response … 回答の送信。いたずらで回答や低評価のメールが積み上がるのを防ぐ
 *
 * IP は lib/ai-check/rate-limit.ts の `hashClientIp` でハッシュにしてから渡す（生のIPは保存しない）。
 *
 * ⚠ **同じ店の Wi-Fi のお客様は同じ IP に見える。** 1つのIPの上限は、混んでいる店の1時間を
 *   止めない大きさにしてある。本当の歯止めは全体の1日上限。
 *
 * 数えられなかったとき（Supabase に繋がらない・表がまだ無い）の扱いは呼び出し側が決める：
 *   polish は断る（費用が青天井になるため）／ response は通す（お客様の回答を落とさないため）。
 */

export type SurveyRequestKind = "polish" | "response";

const LIMITS: Record<SurveyRequestKind, { perIpHourly: number; globalDaily: number }> = {
  // 1人が欄を5つ書き直しながら使っても20回前後。混んだ店の Wi-Fi で1時間に15人でも収まる
  // 全体 6,000回／日 ＝ Haiku で1日あたり数百円が上限（lib/survey/polish-prompt.ts のモデル・上限トークン）
  polish: { perIpHourly: 300, globalDaily: 6000 },
  response: { perIpHourly: 60, globalDaily: 5000 },
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** 古い行を消す確率（1リクエストあたり）。cron を増やさずに掃除する */
const CLEANUP_PROBABILITY = 0.01;
const RETENTION_DAYS = 2;

export type SurveyLimitVerdict =
  | { allowed: true }
  | { allowed: false; reason: "per_ip" | "global" | "unavailable" };

export async function checkSurveyLimit(
  supabase: SupabaseClient,
  ipHash: string,
  kind: SurveyRequestKind,
): Promise<SurveyLimitVerdict> {
  const { perIpHourly, globalDaily } = LIMITS[kind];
  const now = Date.now();
  try {
    const [mine, global] = await Promise.all([
      supabase
        .from("survey_requests")
        .select("*", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .eq("kind", kind)
        .gte("created_at", new Date(now - HOUR_MS).toISOString()),
      supabase
        .from("survey_requests")
        .select("*", { count: "exact", head: true })
        .eq("kind", kind)
        .gte("created_at", new Date(now - DAY_MS).toISOString()),
    ]);
    if (mine.error || global.error) return { allowed: false, reason: "unavailable" };
    if ((mine.count ?? 0) >= perIpHourly) return { allowed: false, reason: "per_ip" };
    if ((global.count ?? 0) >= globalDaily) return { allowed: false, reason: "global" };
    return { allowed: true };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}

/** 使ったことを記録する。失敗しても本体の処理は止めない */
export async function recordSurveyRequest(
  supabase: SupabaseClient,
  ipHash: string,
  kind: SurveyRequestKind,
): Promise<void> {
  await supabase
    .from("survey_requests")
    .insert({ ip_hash: ipHash, kind })
    .then(
      () => {},
      () => {},
    );
  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
    await supabase
      .from("survey_requests")
      .delete()
      .lt("created_at", cutoff)
      .then(
        () => {},
        () => {},
      );
  }
}
