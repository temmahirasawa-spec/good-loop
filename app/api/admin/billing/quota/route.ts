import { NextResponse } from "next/server";
import { STRIPE_ENABLED, STRIPE_PRICE_ADDITIONAL_STORE } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { getTenantBilling } from "@/lib/billing/server";

/**
 * 店舗枠を1つ増やす（docs/specs/billing.md 5章）。
 *
 * Stripe 側の「追加店舗」の数量を増やし、**今月の残り日数ぶんの差額を即時に請求する**
 * （`always_invoice`）。翌月からは増えた数量で満額が請求される。
 *
 * **ここでは `tenants.store_quota` を書き換えない。** 枠を増やすのは Stripe からの通知を
 * 受ける処理（/api/stripe/webhook）1箇所だけにしてある。ここでも書くと、
 * 決済が失敗したのに枠だけ増える経路ができてしまう。
 *
 * Stripe が未接続の契約先は、こちらではなく従来の申し込み
 * （/api/admin/settings/store-quota、supabase/0011）を通る。画面が振り分けている。
 */

export async function POST() {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }

  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!tenant.stripeSubscriptionId) {
    return NextResponse.json({ error: "先にお支払い方法をご登録ください。" }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const additional = subscription.items.data.find((item) => item.price.id === STRIPE_PRICE_ADDITIONAL_STORE);

    if (additional) {
      await stripe.subscriptionItems.update(additional.id, {
        quantity: (additional.quantity ?? 0) + 1,
        proration_behavior: "always_invoice",
      });
    } else {
      // 追加店舗の明細がまだ無い（＝基本プランだけの契約）。ここで作る
      await stripe.subscriptionItems.create({
        subscription: tenant.stripeSubscriptionId,
        price: STRIPE_PRICE_ADDITIONAL_STORE,
        quantity: 1,
        proration_behavior: "always_invoice",
      });
    }

    // 枠に反映されるのは Stripe からの通知が届いた後。画面は少し遅れて更新される
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[billing] 店舗枠の追加（数量変更）に失敗", error);
    return NextResponse.json({ error: "お支払いに失敗しました。カードの状態をご確認ください。" }, { status: 500 });
  }
}
