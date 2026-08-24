import { NextResponse } from "next/server";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { appOrigin, getTenantBilling } from "@/lib/billing/server";

/**
 * カスタマーポータル（docs/specs/billing.md 5章）。
 *
 * カードの変更・プランの確認・請求履歴の全件・領収書は、すべて Stripe が用意した
 * この画面に任せる。自前で作らないのは、カード番号を扱わないためと、
 * 領収書の様式や税表示を Stripe 側の正しい形に揃えるため。
 */

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }

  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!tenant.stripeCustomerId) {
    return NextResponse.json({ error: "お支払い方法がまだ登録されていません。" }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${appOrigin(req)}/admin/settings/billing`,
      locale: "ja",
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing] カスタマーポータルのセッション作成に失敗", error);
    return NextResponse.json({ error: "お支払いの画面を開けませんでした。もう一度お試しください。" }, { status: 500 });
  }
}
