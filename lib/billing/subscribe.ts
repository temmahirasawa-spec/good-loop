import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import {
  STRIPE_PRICE_ADDITIONAL_STORE,
  STRIPE_PRICE_BASE,
  STRIPE_TAX_RATE_ID,
} from "@/lib/billing/config";
import { TRIAL_DAYS } from "@/lib/billing/trial";
import { claimSource, findPriorTrial, recordTrialClaims, type PriorTrial } from "@/lib/billing/eligibility";
import { BILLING } from "@/lib/admin/constants";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * カードの登録と契約の作り方（docs/specs/billing.md §3-3。Q1 の案A）。
 *
 * 1. Checkout の **setup モード**でカードだけ預かる（請求しない）
 * 2. 預かったカードの指紋で、2回目の無料体験かを判定する（§3-4）
 * 3. 体験あり → **こちらのサーバーで**契約を作る（14日間の体験つき。今日の請求は0円）
 *    体験なし → 契約は作らない。料金と理由を見せ、「有料で始める」を押したときだけ契約を作る
 *
 * Stripe の標準の形（subscription モードに体験日数）を使わないのは、カードを入れた瞬間に体験が始まり、
 * 指紋を見る前に「体験あり」の契約ができてしまうため（黙って請求するか、契約を消すしかなくなる）。
 *
 * **戻り先の画面と Webhook のどちらが先に来ても、同じ結果になる**ようにしてある（どちらもここを呼ぶ）。
 * 同じカード登録から契約が2つできないよう、契約の作成には冪等キー（＝同じ依頼を2回送っても
 * 1回分しか実行されない印）を付ける。
 */

// ── 明細と金額 ─────────────────────────────────────────

/** 店舗枠から明細を作る。追加店舗の明細は数量が1以上のときだけ置く（§2） */
export function subscriptionItems(quota: number): { price: string; quantity: number }[] {
  const additional = Math.max(0, quota - BILLING.includedStores);
  return additional > 0
    ? [
        { price: STRIPE_PRICE_BASE, quantity: 1 },
        { price: STRIPE_PRICE_ADDITIONAL_STORE, quantity: additional },
      ]
    : [{ price: STRIPE_PRICE_BASE, quantity: 1 }];
}

export type MonthlyQuote = {
  /** 月額（税抜）。円 */
  excludingTax: number;
  /** 月額（税込）。円 */
  includingTax: number;
};

/**
 * 月額の見積もり。**金額は Stripe の価格と税率から取る**（画面の定数と食い違わないように。§10）。
 * JPY は最小単位が「円」そのもの。
 */
export async function quoteMonthly(quota: number): Promise<MonthlyQuote> {
  const stripe = getStripe();
  const [base, additional, tax] = await Promise.all([
    stripe.prices.retrieve(STRIPE_PRICE_BASE),
    stripe.prices.retrieve(STRIPE_PRICE_ADDITIONAL_STORE),
    stripe.taxRates.retrieve(STRIPE_TAX_RATE_ID),
  ]);
  const extra = Math.max(0, quota - BILLING.includedStores);
  const excludingTax = (base.unit_amount ?? 0) + (additional.unit_amount ?? 0) * extra;
  // 外税。Stripe は明細ごとに税を計算して端数を丸める。ここでは合計に掛けて四捨五入する（表示用の見積もり）
  const includingTax = tax.inclusive ? excludingTax : Math.round(excludingTax * (1 + tax.percentage / 100));
  return { excludingTax, includingTax };
}

// ── 契約の検索と、契約先の状態への反映 ──────────────────────

/** 生きている契約（解約済み・作りかけで期限切れ以外）を Stripe 側で探す。**Stripe を正にする** */
export async function findLiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  return list.data.find((s) => s.status !== "canceled" && s.status !== "incomplete_expired") ?? null;
}

/** Stripe の契約状態を、こちらの5つの状態に寄せる */
export function statusFromSubscription(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // past_due / unpaid / incomplete / paused。いずれも「お支払いを確認できていない」扱い。**止めない**
      return "past_due";
  }
}

function iso(unixSeconds: number | null | undefined): string | null {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

/**
 * 契約の中身を契約先に書き写す（Webhook と、カード登録の直後の両方から呼ぶ）。
 *
 * 同じ契約について何度呼んでも結果が変わらない（上書きだけで、足し算をしない）。
 * **`tenants.store_quota` を書くのは、この関数と Webhook だけ**（決済が失敗したのに枠だけ増える経路を作らない）。
 */
export async function syncTenantFromSubscription(
  admin: SupabaseClient,
  tenantId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  // 店舗枠 = 基本プランに含まれる店舗数 ＋ 「追加店舗」の数量
  const additional = subscription.items.data.find((item) => item.price.id === STRIPE_PRICE_ADDITIONAL_STORE);
  const paidQuota = BILLING.includedStores + (additional?.quantity ?? 0);

  // **いま使っている店舗数を下回る枠には絶対にしない**（2026-08-24）。
  // 下回らせると、運用中の店舗が枠オーバーの状態になり、以後1店舗も追加できなくなる
  const { count } = await admin.from("stores").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const storeQuota = Math.max(paidQuota, count ?? 0);

  // 請求期間は契約そのものではなく、明細（subscription item）が持っている（API 2026-07-29.dahlia で実測）
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
  const status = statusFromSubscription(subscription.status);

  const { error } = await admin
    .from("tenants")
    .update({
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      billing_status: status,
      billing_current_period_end: iso(periodEnd),
      // 体験の終わりの日は Stripe を正にする（画面のカウントダウンと実際の請求日を必ずそろえる。§3-3）
      trial_ends_at: status === "trialing" ? iso(subscription.trial_end) : null,
      // 解約の予約（ポータルで「期間の終わりに解約」）。取り消されたら null に戻る
      billing_cancel_at: iso(subscription.cancel_at),
      // 契約が生きているあいだは「お休みになった日」を持たない
      billing_ended_at: null,
      store_quota: storeQuota,
    })
    .eq("id", tenantId);
  if (error) throw new Error(`契約先の課金状態の更新に失敗: ${error.message}`);
}

// ── カードの登録（setup モード）の後始末 ─────────────────────

export type FinalizeResult =
  /** 無料体験が始まった（または、すでに始まっていた） */
  | { kind: "trial_started"; trialEndsAt: string | null }
  /** 有料の契約がすでにある（2回目の処理・体験なしで始めた後など） */
  | { kind: "already_subscribed" }
  /** 前に無料体験をしていた。料金と理由を見せて「有料で始める／やめる」を選んでもらう */
  | { kind: "needs_paid_confirmation"; prior: PriorTrial; quote: MonthlyQuote }
  /** カードの登録が済んでいない（途中で閉じた・カードが通らなかった） */
  | { kind: "not_completed" };

type TenantRef = { id: string; store_quota: number | null; stripe_customer_id: string | null };

async function loadTenant(admin: SupabaseClient, tenantId: string): Promise<TenantRef> {
  const { data, error } = await admin
    .from("tenants")
    .select("id, store_quota, stripe_customer_id")
    .eq("id", tenantId)
    .maybeSingle<TenantRef>();
  if (error || !data) throw new Error(`契約先が見つからない: ${tenantId}`);
  return data;
}

async function tenantPlaceIds(admin: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data } = await admin.from("stores").select("google_place_id").eq("tenant_id", tenantId);
  return (data ?? []).map((r: { google_place_id: string | null }) => r.google_place_id).filter((v): v is string => Boolean(v));
}

async function customerEmail(customerId: string): Promise<string | null> {
  const customer = await getStripe().customers.retrieve(customerId);
  return "email" in customer ? customer.email ?? null : null;
}

/**
 * カードを預かった Checkout（setup モード）の後始末。
 *
 * @param expectedTenantId 戻り先の画面から呼ぶときは、ログイン中の契約先。**別の契約先のセッションを使わせない**
 */
export async function finalizeCardSetup(sessionId: string, expectedTenantId?: string): Promise<FinalizeResult> {
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["setup_intent.payment_method"] });
  const tenantId = session.metadata?.tenant_id;
  if (!tenantId || (expectedTenantId && tenantId !== expectedTenantId)) {
    throw new Error("このカード登録は、ログイン中の契約先のものではない");
  }
  if (session.mode !== "setup") throw new Error("setup モードのセッションではない");

  const setupIntent = session.setup_intent;
  if (!setupIntent || typeof setupIntent === "string" || setupIntent.status !== "succeeded") return { kind: "not_completed" };
  const paymentMethod = setupIntent.payment_method;
  if (!paymentMethod || typeof paymentMethod === "string") return { kind: "not_completed" };

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) throw new Error("Checkout セッションに顧客が無い");

  // 預かったカードを、請求に使う既定のカードにする（体験のあとの請求・有料で始めるときに使う）
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethod.id } });

  // ── すでに契約があるなら、それを正として返す（2回目の処理。Webhook と戻り先の画面が両方来る）──
  const live = await findLiveSubscription(customerId);
  if (live) {
    await syncTenantFromSubscription(admin, tenantId, live);
    return live.status === "trialing"
      ? { kind: "trial_started", trialEndsAt: iso(live.trial_end) }
      : { kind: "already_subscribed" };
  }

  const tenant = await loadTenant(admin, tenantId);
  const quota = Math.max(1, tenant.store_quota ?? 1);
  const claim = {
    email: await customerEmail(customerId),
    placeIds: await tenantPlaceIds(admin, tenantId),
    cardFingerprint: paymentMethod.card?.fingerprint ?? null,
  };

  // 自分のカード登録（setupIntent.id）が書いた記録は数えない（同時に2回処理したときの誤判定を防ぐ）
  const prior = await findPriorTrial(admin, claim, { setupIntentId: setupIntent.id });
  if (prior) {
    // **契約は作らない。** 料金と理由を見せ、「有料で始める」を押したときだけ請求する（黙って請求しない。§3-4）
    return { kind: "needs_paid_confirmation", prior, quote: await quoteMonthly(quota) };
  }

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: subscriptionItems(quota),
      default_payment_method: paymentMethod.id,
      default_tax_rates: [STRIPE_TAX_RATE_ID],
      trial_period_days: TRIAL_DAYS,
      // 体験の途中でカードが外されたら、請求せずに契約を終える
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      metadata: { tenant_id: tenantId },
    },
    // 同じカード登録から契約が2つできないように（Webhook と戻り先の画面が同時に来ても1つ）
    { idempotencyKey: `trial-subscription:${setupIntent.id}` },
  );

  await recordTrialClaims(admin, claim, claimSource(customerId, setupIntent.id));
  await syncTenantFromSubscription(admin, tenantId, subscription);
  return { kind: "trial_started", trialEndsAt: iso(subscription.trial_end) };
}

// ── カードを入れる前の判定（メールとお店）───────────────────

/**
 * カードを入れる**前**に分かる分だけ判定する（Q3）：メールアドレスと、紐付け済みのお店。
 *
 * カードを預かったまま確認の画面を閉じた人（カードはあるが契約が無い）は、預かったカードの指紋も見る。
 * そうしないと、閉じて開き直すだけで「体験あり」の案内に戻ってしまう。
 */
export async function precheckTrial(tenantId: string, email: string | null): Promise<PriorTrial | null> {
  const admin = createSupabaseAdminClient();
  const tenant = await loadTenant(admin, tenantId);
  let cardFingerprint: string | null = null;
  if (tenant.stripe_customer_id) {
    const customer = await getStripe().customers.retrieve(tenant.stripe_customer_id, {
      expand: ["invoice_settings.default_payment_method"],
    });
    const pm = "invoice_settings" in customer ? customer.invoice_settings?.default_payment_method : null;
    if (pm && typeof pm !== "string") cardFingerprint = pm.card?.fingerprint ?? null;
  }
  return findPriorTrial(admin, { email, placeIds: await tenantPlaceIds(admin, tenantId), cardFingerprint });
}

/** 契約先の店舗枠（契約の数量の元）。読めなければ1 */
export async function tenantQuota(tenantId: string): Promise<number> {
  const tenant = await loadTenant(createSupabaseAdminClient(), tenantId);
  return Math.max(1, tenant.store_quota ?? 1);
}

// ── 有料で始める ────────────────────────────────────────

export type StartPaidResult =
  | { kind: "started" }
  /** カードの会社が本人確認（3Dセキュア）を求めた。Stripe の請求書の画面で済ませてもらう */
  | { kind: "requires_action"; invoiceUrl: string }
  | { kind: "no_card" };

/**
 * 体験なしで契約を作り、今日の分を請求する（対象外の確認で「有料で始める」を押したとき）。
 *
 * カードは直前の setup モードで預かった既定のカードを使う。
 * メール・お店で先に対象外と分かっている場合は、カードを預かる前なので、
 * こちらではなく subscription モードの Checkout（createPaidCheckout）を使う。
 */
export async function startPaidSubscription(tenantId: string): Promise<StartPaidResult> {
  const stripe = getStripe();
  const admin = createSupabaseAdminClient();
  const tenant = await loadTenant(admin, tenantId);
  if (!tenant.stripe_customer_id) return { kind: "no_card" };

  const existing = await findLiveSubscription(tenant.stripe_customer_id);
  if (existing) {
    await syncTenantFromSubscription(admin, tenantId, existing);
    return { kind: "started" };
  }

  const customer = await stripe.customers.retrieve(tenant.stripe_customer_id);
  const card = "invoice_settings" in customer ? customer.invoice_settings?.default_payment_method : null;
  const cardId = typeof card === "string" ? card : card?.id;
  if (!cardId) return { kind: "no_card" };

  const quota = Math.max(1, tenant.store_quota ?? 1);
  const subscription = await stripe.subscriptions.create(
    {
      customer: tenant.stripe_customer_id,
      items: subscriptionItems(quota),
      default_payment_method: cardId,
      default_tax_rates: [STRIPE_TAX_RATE_ID],
      // 本人確認が要るときも契約は作り、請求書の画面で済ませてもらう（その間は past_due 扱いで止めない）
      payment_behavior: "allow_incomplete",
      expand: ["latest_invoice"],
      metadata: { tenant_id: tenantId },
    },
    // 同じ日に2回押しても、契約は1つ
    { idempotencyKey: `paid-subscription:${tenantId}:${new Date().toISOString().slice(0, 10)}` },
  );

  await syncTenantFromSubscription(admin, tenantId, subscription);
  if (subscription.status === "incomplete") {
    const invoice = subscription.latest_invoice;
    const url = invoice && typeof invoice !== "string" ? invoice.hosted_invoice_url : null;
    if (url) return { kind: "requires_action", invoiceUrl: url };
  }
  return { kind: "started" };
}
