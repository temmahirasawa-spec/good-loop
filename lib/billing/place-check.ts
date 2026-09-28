import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { findPriorTrial, recordTrialClaims } from "@/lib/billing/eligibility";
import { quoteMonthly, syncTenantFromSubscription, type MonthlyQuote } from "@/lib/billing/subscribe";

/**
 * 体験中に、Google マップのお店を紐付けるときの判定（docs/specs/billing.md §3-4 の Q4）。
 *
 * 前に無料体験をしたお店を体験中に紐付けたら、**確認の画面を出す。「有料に切り替えて紐付ける」を選んだときだけ、
 * 体験を終えて請求する。** 何も言わずに紐付けさせると抜け道になり、何も言わずに請求すると「黙って請求しない」に反する。
 *
 * 前に体験していないお店なら、体験に使ったお店として記録する（この体験のあと、別のアカウントで2回目を使えないように）。
 *
 * カードを登録する前（体験がまだ始まっていない）は、ここでは見ない。カードを登録するときにまとめて判定する。
 */

export type PlaceCheck =
  | { ok: true }
  | { ok: false; needsPaidConfirmation: true; quote: MonthlyQuote };

type Row = { billing_status: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null; store_quota: number | null };

export async function checkPlaceLink(tenantId: string, placeId: string, confirmPaid: boolean): Promise<PlaceCheck> {
  if (!STRIPE_ENABLED || !placeId.trim()) return { ok: true };

  const admin = createSupabaseAdminClient();
  const { data: t } = await admin
    .from("tenants")
    .select("billing_status, stripe_subscription_id, stripe_customer_id, store_quota")
    .eq("id", tenantId)
    .maybeSingle<Row>();
  if (!t || t.billing_status !== "trialing" || !t.stripe_subscription_id || !t.stripe_customer_id) return { ok: true };

  // 自分の体験で記録したお店（紐付け直し）は数えない
  const prior = await findPriorTrial(admin, { placeIds: [placeId] }, { customerId: t.stripe_customer_id });
  if (!prior) {
    await recordTrialClaims(admin, { placeIds: [placeId] }, `${t.stripe_customer_id}:link`);
    return { ok: true };
  }

  if (!confirmPaid) {
    return { ok: false, needsPaidConfirmation: true, quote: await quoteMonthly(Math.max(1, t.store_quota ?? 1)) };
  }

  // 「有料に切り替えて紐付ける」を押した。体験を今日で終え、今日の分を請求する
  const subscription = await getStripe().subscriptions.update(t.stripe_subscription_id, {
    trial_end: "now",
    proration_behavior: "none",
  });
  await syncTenantFromSubscription(admin, tenantId, subscription);
  return { ok: true };
}
