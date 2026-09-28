import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalizeCardSetup, syncTenantFromSubscription } from "@/lib/billing/subscribe";
import { sendTrialWillEnd } from "@/lib/billing/notices";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * Stripe からの通知の受け口（docs/specs/billing.md §7）。
 *
 * **`tenants.store_quota` を書き換えるのはここ（と、カード登録の直後の同じ処理）だけ。** 決済の画面を作る側
 * （/api/admin/billing/quota）では書かない。両方で書くと、決済が失敗したのに枠だけ増える経路ができてしまう。
 *
 * ── 署名の検証 ───────────────────────────────────────────
 * 本文の生のバイト列と `stripe-signature` ヘッダを突き合わせて、本当に Stripe から
 * 来たものかを確かめる。**これをしないと、誰でも「支払いが済んだ」という嘘の通知を
 * 送って店舗枠を増やせる。** 検証には加工前の本文が要るので `req.text()` で受ける
 * （`req.json()` を通すと本文が組み替わって検証に落ちる）。
 *
 * ── 同じ通知が2回届くこと ─────────────────────────────────
 * Stripe は同じ通知を複数回送ることがある。ここでの更新はすべて「その時点の値で上書き」
 * にしてあり、足し算をしていない。メールは送った記録（billing_notices）で2回目を止める。
 */

// 署名の検証に Node の暗号処理を使う。Edge ランタイムでは動かない
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    // 偽の通知か、署名シークレットの取り違え。どちらにせよ受け付けない。
    // 取り違えの場合はこのログだけが手がかりになる
    console.error("[billing] Webhook の署名検証に失敗", error);
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object);
        break;
      case "customer.subscription.trial_will_end":
        await onTrialWillEnd(event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object);
        break;
      default:
        // 登録していない種類が届いても無視する（Stripe 側の設定が増えたときに落ちないように）
        break;
    }
  } catch (error) {
    // 500 を返すと Stripe が時間をおいて送り直してくれる。握りつぶさない
    console.error(`[billing] Webhook の処理に失敗 (${event.type})`, error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Stripe のフィールドは「IDの文字列」か「展開されたオブジェクト」のどちらかで届く */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * どの契約先の話かを突き止める。
 *
 * **Stripe の顧客ID（stripe_customer_id）を正にする**（§7。Stripe の推奨）。
 * 見つからないとき（顧客IDを保存する前に通知が来たなど）だけ、こちらが入れた `tenant_id` を使う。
 */
async function resolveTenantId(customerId: string | null, metadata: Stripe.Metadata | null | undefined): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (customerId) {
    const { data } = await admin.from("tenants").select("id").eq("stripe_customer_id", customerId).maybeSingle<{ id: string }>();
    if (data?.id) return data.id;
  }
  const fromMetadata = metadata?.tenant_id;
  return typeof fromMetadata === "string" && fromMetadata ? fromMetadata : null;
}

/** いま契約先に結び付いている契約ID */
async function currentSubscriptionId(tenantId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("stripe_subscription_id")
    .eq("id", tenantId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  return data?.stripe_subscription_id ?? null;
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "setup") {
    // カードだけ預かった（2026-09-28 からの入口）。判定して、体験ありなら契約を作る。
    // 対象外（2回目）なら何もしない。戻り先の画面で「有料で始める／やめる」を選んでもらう（§3-3）
    await finalizeCardSetup(session.id);
    return;
  }

  // subscription モード（メール・お店で先に対象外と分かっていて「有料で始める」を押した人、または旧い入口）
  const tenantId = await resolveTenantId(idOf(session.customer), session.metadata);
  if (!tenantId) return;
  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await syncTenantFromSubscription(createSupabaseAdminClient(), tenantId, subscription);
}

async function onSubscriptionChanged(received: Stripe.Subscription) {
  const tenantId = await resolveTenantId(idOf(received.customer), received.metadata);
  if (!tenantId) return;

  // 通知は届く順番が前後することがある（Stripe の仕様）。本文をそのまま書くと、古い状態で上書きしうる。
  // **Stripe から最新の契約を取り直してから写す**（2026-09-29 の点検で追加）
  const subscription = await getStripe().subscriptions.retrieve(received.id);

  // 古い契約の知らせで、新しい契約の状態を上書きしない（解約後にもう一度登録した契約先など）
  const current = await currentSubscriptionId(tenantId);
  const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
  if (current && current !== subscription.id && ended) return;

  await syncTenantFromSubscription(createSupabaseAdminClient(), tenantId, subscription);
  await recordCancellation(tenantId, subscription);
}

/**
 * 解約の理由（Q7。Stripe の解約画面の「理由」）を記録する。
 * 解約を予約したとき（期間の終わりに解約）と、契約が終わったときの両方で呼ぶ。同じ契約は1件にまとめる。
 */
async function recordCancellation(tenantId: string, subscription: Stripe.Subscription) {
  const requested = subscription.cancel_at_period_end || Boolean(subscription.cancel_at) || subscription.status === "canceled";
  const details = subscription.cancellation_details;
  if (!requested || !details) return;
  // 支払いの失敗で終わった契約は「解約の理由」ではない
  if (details.reason === "payment_failed" || details.reason === "payment_disputed") return;

  const admin = createSupabaseAdminClient();
  await admin.from("cancellation_feedback").upsert(
    {
      tenant_id: tenantId,
      stripe_subscription_id: subscription.id,
      reason: details.feedback ?? null,
      comment: details.comment ?? null,
      during_trial: subscription.status === "trialing" || Boolean(subscription.trial_end && subscription.canceled_at && subscription.canceled_at <= subscription.trial_end),
    },
    { onConflict: "tenant_id,stripe_subscription_id" },
  );
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantId(idOf(subscription.customer), subscription.metadata);
  if (!tenantId) return;

  // 古い契約の終わりで、新しい契約を消さない
  const current = await currentSubscriptionId(tenantId);
  if (current && current !== subscription.id) return;

  await recordCancellation(tenantId, subscription);

  // **お休みにする**（§3-8）。契約IDを空にするので、もう一度「カードを登録する」が出る（§12 の3）。
  // **店舗枠は減らさない。** 減らすと、運用中の店舗が枠オーバーになって店舗が消えたように見える
  const admin = createSupabaseAdminClient();
  await admin
    .from("tenants")
    .update({
      billing_status: "canceled" satisfies BillingStatus,
      stripe_subscription_id: null,
      billing_cancel_at: null,
      trial_ends_at: null,
      billing_ended_at: new Date((subscription.ended_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    })
    .eq("id", tenantId);
}

/** 体験が終わる3日前（Stripe が送ってくる）。結果つきのお知らせのメール（§3-6） */
async function onTrialWillEnd(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantId(idOf(subscription.customer), subscription.metadata);
  if (!tenantId || !subscription.trial_end || !subscription.trial_start) return;
  // 解約を予約済みなら「お支払いが始まります」とは送らない（体験の最終日で終わるため）
  if (subscription.cancel_at_period_end || subscription.cancel_at) return;

  // 金額は契約の明細と税率から出す（画面の定数ではなく、実際に請求される額）
  const excludingTax = subscription.items.data.reduce((sum, item) => sum + (item.price.unit_amount ?? 0) * (item.quantity ?? 1), 0);
  const taxPercent = (subscription.default_tax_rates ?? []).reduce((sum, r) => sum + (r.inclusive ? 0 : r.percentage), 0);
  const includingTax = Math.round(excludingTax * (1 + taxPercent / 100));

  await sendTrialWillEnd(createSupabaseAdminClient(), {
    tenantId,
    customerId: idOf(subscription.customer),
    trialStart: new Date(subscription.trial_start * 1000).toISOString(),
    trialEndsAt: new Date(subscription.trial_end * 1000).toISOString(),
    monthlyExcludingTax: excludingTax,
    monthlyIncludingTax: includingTax,
  });
}

/** 請求が通った（体験のあとの初回・毎月の更新・未払いからの回復）。契約の最新の状態を写す */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription ?? null);
  if (!subscriptionId) return;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const tenantId = await resolveTenantId(idOf(subscription.customer), subscription.metadata);
  if (!tenantId) return;
  const current = await currentSubscriptionId(tenantId);
  if (current && current !== subscription.id) return;
  await syncTenantFromSubscription(createSupabaseAdminClient(), tenantId, subscription);
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const tenantId = await resolveTenantId(idOf(invoice.customer), invoice.metadata);
  if (!tenantId) return;
  // 今の契約の請求のときだけ（古い契約の請求の失敗で、新しい契約を未払いにしない）
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription ?? null);
  const current = await currentSubscriptionId(tenantId);
  if (subscriptionId && current && subscriptionId !== current) return;

  // 未払い。**止めない**（§3-8）。再請求が尽きたら Stripe が契約を終わらせ、deleted でお休みになる
  const admin = createSupabaseAdminClient();
  await admin.from("tenants").update({ billing_status: "past_due" satisfies BillingStatus }).eq("id", tenantId);
}
