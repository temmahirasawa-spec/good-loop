import { SettingsBillingView } from "@/components/admin/SettingsBillingView";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { getBillingState } from "@/lib/billing/state";
import { getBillingDisplay } from "@/lib/billing/stripe";
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
 * 契約状態（DB）を先に引いてから、その顧客IDで Stripe に問い合わせる二段構えなので、
 * カード未登録の契約先には Stripe への問い合わせ自体が発生しない。
 */
export default async function SettingsBillingPage() {
  const [quota, billing] = await Promise.all([getStoreQuotaState(), getBillingState()]);
  const display = await getBillingDisplay(billing.customerId);

  return (
    <SettingsBillingView
      quota={{ quota: quota.quota, used: quota.used, hasPendingRequest: quota.hasPendingRequest }}
      billing={{ status: billing.status, connected: billing.connected }}
      stripeEnabled={STRIPE_ENABLED}
      card={display.card}
      invoices={display.invoices}
      lookupFailed={display.lookupFailed}
    />
  );
}
