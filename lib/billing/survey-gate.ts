import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { billingStateFromRow, TENANT_BILLING_COLUMNS, type TenantBillingRow } from "@/lib/billing/state";

/**
 * 来店客のアンケートを止めるか（docs/specs/billing.md §3-2 の Q2・§3-8）。
 *
 * 止めるのは、①申し込みから来た契約先で、まだカードを登録していないとき ②お休みのとき。
 * 営業経由の契約先（card_required = false）は止めない（いま動いているお店のアンケートは止まらない）。
 *
 * **画面だけでなく、回答を受け付ける API も同じ判定で断る。** 画面だけ止めても、
 * API を直接呼ばれると回答できてしまうため。
 *
 * 来店客はログインしないので、service_role のクライアントで読む。**必ず tenantId で絞る。**
 * 読めなかったときは止めない（一時的な失敗で、動いているお店のアンケートを止めないため）。
 */
export async function isSurveyStopped(admin: SupabaseClient, tenantId: string): Promise<boolean> {
  const { data, error } = await admin.from("tenants").select(TENANT_BILLING_COLUMNS).eq("id", tenantId).maybeSingle<TenantBillingRow>();
  if (error || !data) return false;
  return billingStateFromRow(data).access.surveyStopped;
}
