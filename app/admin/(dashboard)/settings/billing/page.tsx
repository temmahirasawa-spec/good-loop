import { SettingsBillingView } from "@/components/admin/SettingsBillingView";
import { getStoreQuotaState } from "@/lib/admin/store-quota";

// 契約中の店舗枠は毎リクエスト取得する（枠を増やした直後に古い値が出ないように）
export const dynamic = "force-dynamic";

/**
 * 設定（お支払い） Figma node 73:1399 PC / 75:1862 SP。
 *
 * 2026-08-21、店舗枠（supabase/0009）の欄を追加した。表示は SettingsBillingView。
 */
export default async function SettingsBillingPage() {
  const quota = await getStoreQuotaState();

  return <SettingsBillingView quota={{ quota: quota.quota, used: quota.used, hasPendingRequest: quota.hasPendingRequest }} />;
}
