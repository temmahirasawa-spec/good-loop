import { NextResponse } from "next/server";
import { STRIPE_ENABLED, STRIPE_PRICE_ADDITIONAL_STORE, STRIPE_PRICE_BASE } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { appOrigin, ensureStripeCustomer, getTenantBilling } from "@/lib/billing/server";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { BILLING } from "@/lib/admin/constants";

/**
 * カードの登録と初回のお支払い（docs/specs/billing.md 6章）。
 *
 * **この経路ではカード番号を受け取らない。** Stripe が用意した入力画面のURLを作って返し、
 * ブラウザをそちらへ送るだけ。カード番号は GOOD REVIEW のサーバーを一切通らない
 * （2026-08-24 天真の決定）。
 *
 * ── いま使っている店舗枠ぶんの契約を作る（2026-08-24 追加）──────────
 * 基本プランだけの契約を作ってはいけない。カード登録前の契約先は、運営が手で
 * `store_quota` を増やしている場合があり（例: 夙川店のテナントは 3）、
 * 基本プラン（1店舗込み）だけで契約すると Stripe からの通知で **枠が 3 → 1 に減る**。
 * 既存の店舗は消えないが枠オーバーになり、以後1店舗も追加できなくなる。
 *
 * そのため「いまの枠と同じ数で契約する」＝ 3店舗使っているなら3店舗ぶん払う、
 * という自然な形にしている。
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

  const quota = await getStoreQuotaState();
  if (quota.quota === null) {
    // 枠が読めない状態で契約を作ると、いくつぶんの契約なのかが決められない。
    // 少ない数で契約してしまうと枠が減るので、ここでは進めずに止める
    return NextResponse.json({ error: "店舗枠を取得できませんでした。時間をおいてお試しください。" }, { status: 503 });
  }

  // いまの枠のうち、基本プランに含まれない超過ぶん
  const additionalStores = Math.max(0, quota.quota - BILLING.includedStores);

  try {
    const stripe = getStripe();
    const customer = await ensureStripeCustomer(tenant);
    const origin = appOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items:
        additionalStores > 0
          ? [
              { price: STRIPE_PRICE_BASE, quantity: 1 },
              { price: STRIPE_PRICE_ADDITIONAL_STORE, quantity: additionalStores },
            ]
          : [{ price: STRIPE_PRICE_BASE, quantity: 1 }],
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
