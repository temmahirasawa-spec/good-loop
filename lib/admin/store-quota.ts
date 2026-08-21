import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 店舗枠（契約している店舗数）の取得（supabase/0009、2026-08-21）。
 *
 * 店舗の追加には追加課金が必要という天真の決定により、
 * 「契約している店舗数」を超える店舗は作れない。枠の実体は tenants.store_quota で、
 * 利用者自身には書き換えられないようにしてある（0009 の GRANT 参照）。
 *
 * 枠が読めなかったときは `canAddStore: false`（＝追加できない）側に倒す。
 * 読めない原因はSQL未実行・未ログインのどちらかで、どちらの場合も
 * 「課金なしで店舗が増える」ほうが事故として大きいため。
 */

export type StoreQuotaState = {
  /** 契約している店舗数 */
  quota: number;
  /** いま使っている店舗数 */
  used: number;
  /** 店舗を追加できるか（＝枠に空きがあるか） */
  canAddStore: boolean;
  /** 枠の追加を申し込み済みで、まだ運営が処理していない状態か */
  hasPendingRequest: boolean;
};

export async function getStoreQuotaState(): Promise<StoreQuotaState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return { quota: 0, used: 0, canAddStore: false, hasPendingRequest: false };

  const [{ data: tenant }, { count }, { data: pending }] = await Promise.all([
    supabase.from("tenants").select("store_quota").eq("id", tenantId).maybeSingle<{ store_quota: number }>(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("store_quota_requests").select("id").eq("status", "pending").limit(1).returns<{ id: string }[]>(),
  ]);

  const quota = tenant?.store_quota ?? 0;
  const used = count ?? 0;

  return {
    quota,
    used,
    canAddStore: used < quota,
    hasPendingRequest: (pending?.length ?? 0) > 0,
  };
}
