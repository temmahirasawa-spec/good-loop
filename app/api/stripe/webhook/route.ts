import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { STRIPE_PRICE_ADDITIONAL_STORE } from "@/lib/billing/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BILLING } from "@/lib/admin/constants";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * Stripe からの通知の受け口（docs/specs/billing.md 6章）。
 *
 * **`tenants.store_quota` を書き換えるのはここだけ。** 決済の画面を作る側
 * （/api/admin/billing/quota）では書かない。両方で書くと、決済が失敗したのに
 * 枠だけ増える経路ができてしまう。
 *
 * ── 署名の検証 ───────────────────────────────────────────
 * 本文の生のバイト列と `stripe-signature` ヘッダを突き合わせて、本当に Stripe から
 * 来たものかを確かめる。**これをしないと、誰でも「支払いが済んだ」という嘘の通知を
 * 送って店舗枠を増やせる。** 検証には加工前の本文が要るので `req.text()` で受ける
 * （`req.json()` を通すと本文が組み替わって検証に落ちる）。
 *
 * ── 同じ通知が2回届くこと ─────────────────────────────────
 * Stripe は同じ通知を複数回送ることがある。ここでの更新はすべて「その時点の値で上書き」
 * にしてあり、足し算をしていない。2回届いても結果は変わらない。
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
  } catch {
    // 偽の通知か、署名シークレットの取り違え。どちらにせよ受け付けない
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
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object);
        break;
      default:
        // 登録していない種類が届いても無視する（Stripe 側の設定が増えたときに落ちないように）
        break;
    }
  } catch {
    // 500 を返すと Stripe が時間をおいて送り直してくれる。握りつぶさない
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
 * まず通知に載っている `tenant_id`（こちらが決済を作るときに入れたもの）を見る。
 * 載っていない種類の通知もあるため、そのときは Stripe の顧客IDから引き直す。
 */
async function resolveTenantId(customerId: string | null, metadata: Stripe.Metadata | null | undefined): Promise<string | null> {
  const fromMetadata = metadata?.tenant_id;
  if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;
  if (!customerId) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("tenants")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();

  return data?.id ?? null;
}

/** Stripe の契約状態を、こちらの4つの状態に寄せる */
function toBillingStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // past_due / unpaid / incomplete / paused。いずれも「お支払いを確認できていない」扱い
      return "past_due";
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = idOf(session.customer);
  const tenantId = await resolveTenantId(customerId, session.metadata);
  if (!tenantId) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from("tenants")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: idOf(session.subscription),
    })
    .eq("id", tenantId);
}

async function onSubscriptionChanged(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantId(idOf(subscription.customer), subscription.metadata);
  if (!tenantId) return;

  // 店舗枠 = 基本プランに含まれる店舗数 ＋ 「追加店舗」の数量
  const additional = subscription.items.data.find((item) => item.price.id === STRIPE_PRICE_ADDITIONAL_STORE);
  const paidQuota = BILLING.includedStores + (additional?.quantity ?? 0);

  const admin = createSupabaseAdminClient();

  // **いま使っている店舗数を下回る枠には絶対にしない**（2026-08-24）。
  // 下回らせると、運用中の店舗が枠オーバーの状態になり、以後1店舗も追加できなくなる。
  // 決済の入口（/api/admin/billing/checkout）は現在の枠と同じ数で契約を作るので
  // 通常ここには掛からないが、Stripe のカスタマーポータルから数量を減らされた場合や、
  // 運営が手で枠を増やしていた契約先があとから契約した場合の保険として置く。
  //
  // 「払っていない店舗が使えてしまう」状態にはなるが、それは未払いと同じ扱いで、
  // 人が連絡して決める（docs/specs/billing.md 4章）。画面が壊れるほうが害が大きい。
  const { count } = await admin
    .from("stores")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const storeQuota = Math.max(paidQuota, count ?? 0);

  // 請求期間は契約そのものではなく、明細（subscription item）が持っている
  // （Stripe API 2026-07-29.dahlia。2026-08-24 に型で実測）
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;

  await admin
    .from("tenants")
    .update({
      stripe_customer_id: idOf(subscription.customer),
      stripe_subscription_id: subscription.id,
      billing_status: toBillingStatus(subscription.status),
      billing_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      store_quota: storeQuota,
    })
    .eq("id", tenantId);
}

async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantId(idOf(subscription.customer), subscription.metadata);
  if (!tenantId) return;

  // **店舗枠は減らさない。** 減らすと、運用中の店舗が枠オーバーになって
  // 画面上あたかも店舗が消えたように見える。解約後の扱いは人が連絡して決める
  // （docs/specs/billing.md 4章）
  const admin = createSupabaseAdminClient();
  await admin.from("tenants").update({ billing_status: "canceled" satisfies BillingStatus }).eq("id", tenantId);
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
  const tenantId = await resolveTenantId(idOf(invoice.customer), invoice.metadata);
  if (!tenantId) return;

  const admin = createSupabaseAdminClient();
  await admin.from("tenants").update({ billing_status: "past_due" satisfies BillingStatus }).eq("id", tenantId);
}
