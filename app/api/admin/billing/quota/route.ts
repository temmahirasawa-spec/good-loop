import { NextResponse } from "next/server";
import { STRIPE_ENABLED, STRIPE_PRICE_ADDITIONAL_STORE } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { getTenantBilling } from "@/lib/billing/server";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { isValidStoreCount } from "@/lib/signup/plan";
import { BILLING } from "@/lib/admin/constants";

/**
 * 店舗枠の変更（docs/specs/billing.md 5章、2026-08-25 増減に対応）。
 *
 * ステッパーで選んだ「希望の枠数」を受け取り、Stripe 側の「追加店舗」の数量を合わせる。
 *
 * | 方向 | 請求の扱い |
 * |---|---|
 * | 増やす | **今月の残り日数ぶんの差額を即時に請求**（`always_invoice`。従来どおり） |
 * | 減らす | **次のお支払いから反映**（`none`）。日割りの返金はしない |
 *
 * 減らすときに返金しないのは、月の途中の減枠で返金を始めると経理が複雑になるため
 * （一般的なSaaSの扱いに合わせた）。
 *
 * ⚠ **ここでは `tenants.store_quota` を書き換えない。** 枠を変えるのは Stripe からの
 * 通知（/api/stripe/webhook）1箇所だけ。決済が失敗したのに枠だけ変わる経路を作らない。
 *
 * ⚠ **いま使っている店舗数より減らせない。** 減らすと枠オーバーになり、
 * 以後1店舗も追加できなくなる（webhook 側にも同じ保険がある。二重の防御）。
 */

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }

  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!tenant.stripeSubscriptionId) {
    return NextResponse.json({ error: "先にお支払い方法をご登録ください。" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { desiredQuota?: unknown } | null;
  const desired = Number(body?.desiredQuota);
  if (!isValidStoreCount(desired)) {
    return NextResponse.json({ error: "店舗枠の値をご確認ください。" }, { status: 400 });
  }

  const quota = await getStoreQuotaState();
  if (quota.quota === null) {
    return NextResponse.json({ error: "店舗枠を取得できませんでした。時間をおいてお試しください。" }, { status: 503 });
  }
  if (desired === quota.quota) {
    return NextResponse.json({ error: "店舗枠は変わっていません。" }, { status: 400 });
  }
  if (desired < quota.used) {
    return NextResponse.json(
      { error: `いま${quota.used}店舗をお使いのため、${quota.used}店舗より少なくはできません。` },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
    const additional = subscription.items.data.find((item) => item.price.id === STRIPE_PRICE_ADDITIONAL_STORE);
    const desiredAdditional = Math.max(0, desired - BILLING.includedStores);
    const increasing = desired > quota.quota;
    // 増=即時差額 / 減=次のお支払いから（返金しない）
    const proration = increasing ? "always_invoice" : "none";

    if (additional) {
      await stripe.subscriptionItems.update(additional.id, {
        quantity: desiredAdditional,
        proration_behavior: proration,
      });
    } else if (desiredAdditional > 0) {
      // 追加店舗の明細がまだ無い（＝基本プランだけの契約）。ここで作る
      await stripe.subscriptionItems.create({
        subscription: tenant.stripeSubscriptionId,
        price: STRIPE_PRICE_ADDITIONAL_STORE,
        quantity: desiredAdditional,
        proration_behavior: proration,
      });
    }

    // 枠に反映されるのは Stripe からの通知が届いた後。画面は少し遅れて更新される
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[billing] 店舗枠の変更（数量変更）に失敗", error);
    return NextResponse.json({ error: "お支払いに失敗しました。カードの状態をご確認ください。" }, { status: 500 });
  }
}
