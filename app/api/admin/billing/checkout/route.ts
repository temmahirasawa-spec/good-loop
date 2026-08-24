import { NextResponse } from "next/server";
import { STRIPE_ENABLED, STRIPE_PRICE_BASE } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { appOrigin, ensureStripeCustomer, getTenantBilling } from "@/lib/billing/server";

/**
 * カードの登録と初回のお支払い（docs/specs/billing.md 6章）。
 *
 * **この経路ではカード番号を受け取らない。** Stripe が用意した入力画面のURLを作って返し、
 * ブラウザをそちらへ送るだけ。カード番号は GOOD REVIEW のサーバーを一切通らない
 * （2026-08-24 天真の決定）。
 *
 * 契約は「基本プラン × 1」だけで始める。追加店舗の明細は、店舗枠を増やすとき
 * （/api/admin/billing/quota）に作る。数量0の明細を先に置いておく形は取らない。
 */

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }

  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // すでに契約がある状態でもう一度ここを通すと、契約が二重になって二重に請求される
  if (tenant.stripeSubscriptionId) {
    return NextResponse.json({ error: "すでにご契約済みです。変更はお支払い方法の画面から行えます。" }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const customer = await ensureStripeCustomer(tenant);
    const origin = appOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: STRIPE_PRICE_BASE, quantity: 1 }],
      // 契約先IDは通知の両方の経路（セッション・契約）に載せる。
      // Stripe から届く通知の種類によって、載っている場所が違うため
      metadata: { tenant_id: tenant.tenantId },
      subscription_data: { metadata: { tenant_id: tenant.tenantId } },
      success_url: `${origin}/admin/settings/billing`,
      cancel_url: `${origin}/admin/settings/billing`,
      locale: "ja",
    });

    if (!session.url) throw new Error("Checkout セッションのURLが返らなかった");
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "お支払いの画面を開けませんでした。もう一度お試しください。" }, { status: 500 });
  }
}
