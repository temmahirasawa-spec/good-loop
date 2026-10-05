import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 無料体験の「先に動く数字」（docs/specs/billing.md §3-5）。
 *
 * Google のクチコミの件数は遅れて増えるので、体験中はこの4つを見せる。
 * LP の約束（「管理画面で分かるのは、読み取られた数・回答・Googleの投稿画面を開いた数まで」）と同じ。
 * **Google に実際に投稿された数は出さない**（取得していない）。
 *
 * 管理画面のトップ（ログイン中）とメール（サーバー）の両方で同じ数え方をする。
 * そのため、どのクライアント（ログイン中の RLS つき／service_role）でも動く形にしてある。
 * service_role で呼ぶときは **必ず tenantId で絞る**（テナント分離を素通りする鍵のため）。
 */

export type TrialResults = {
  /** 二次元コードが読み取られた数（page_views） */
  scans: number;
  /** アンケートの回答の数 */
  responses: number;
  /** Google の投稿画面を開いた数（開いた回答の数。1人が2回開いても1） */
  openedGoogle: number;
  /** お店にだけ届いた声（Google に進まなかった回答） */
  storeOnly: number;
};

export async function getTrialResults(supabase: SupabaseClient, tenantId: string, since: string): Promise<TrialResults> {
  const [views, responses] = await Promise.all([
    supabase.from("page_views").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since),
    supabase
      .from("survey_responses")
      .select("id, conversion_events(event_type)")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .returns<{ id: string; conversion_events: { event_type: string }[] | null }[]>(),
  ]);

  const rows = responses.data ?? [];
  const openedGoogle = rows.filter((r) => (r.conversion_events ?? []).some((e) => e.event_type === "opened_google")).length;
  return {
    scans: views.count ?? 0,
    responses: rows.length,
    openedGoogle,
    storeOnly: rows.length - openedGoogle,
  };
}
