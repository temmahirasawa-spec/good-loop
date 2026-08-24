import { SettingsBillingView } from "@/components/admin/SettingsBillingView";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { getBillingState } from "@/lib/billing/state";
import { STRIPE_ENABLED } from "@/lib/billing/config";

// 契約中の店舗枠と課金の状態は毎リクエスト取得する（枠を増やした直後に古い値が出ないように）
export const dynamic = "force-dynamic";

/**
 * 設定（お支払い） Figma node 73:1399 PC / 75:1862 SP。
 *
 * 2026-08-21、店舗枠（supabase/0009）の欄を追加した。
 * 2026-08-24、Stripe を接続した（docs/specs/billing.md）。
 *
 * カードの下4桁と請求履歴は **Stripe から都度取得する**（DBに保存しない。同 5章）。
 * ただしその取得は Stripe の鍵が揃っている環境でしか行わない。鍵が無いあいだは
 * 「未登録・請求なし」を出す ＝ 事実どおりの表示になる（同 7章）。
 */
export default async function SettingsBillingPage() {
  const [quota, billing] = await Promise.all([getStoreQuotaState(), getBillingState()]);

  return (
    <SettingsBillingView
      quota={{ quota: quota.quota, used: quota.used, hasPendingRequest: quota.hasPendingRequest }}
      billing={{ status: billing.status, connected: billing.connected }}
      stripeEnabled={STRIPE_ENABLED}
      card={null}
      invoices={[]}
      lookupFailed={false}
    />
  );
}
