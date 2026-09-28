import { NextResponse } from "next/server";
import { STRIPE_ENABLED, STRIPE_TAX_RATE_ID } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { appOrigin, ensureStripeCustomer, getTenantBilling } from "@/lib/billing/server";
import {
  findLiveSubscription,
  precheckTrial,
  quoteMonthly,
  subscriptionItems,
  syncTenantFromSubscription,
  tenantQuota,
} from "@/lib/billing/subscribe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * カードの登録（docs/specs/billing.md §3-3。Q1 の案A）。
 *
 * **この経路ではカード番号を受け取らない。** Stripe が用意した入力画面のURLを作って返し、
 * ブラウザをそちらへ送るだけ。カード番号は GOOD REVIEW のサーバーを一切通らない
 * （2026-08-24 天真の決定）。
 *
 * | 判定（メール・お店。カードを入れる前） | 送る画面 |
 * |---|---|
 * | 体験あり | **setup モード**（カードを預かるだけ。今日の請求は0円）→ 戻り先で指紋を見て、体験つきの契約を作る |
 * | 体験なし（2回目）で「有料で始める」を押した | subscription モード（今日の分を請求する） |
 * | 体験なしで、まだ「有料で始める」を押していない | 画面を作らない。理由と金額を返し、確認の画面を出してもらう（**黙って請求しない**） |
 *
 * 判定は**必ずここ（サーバー）でやり直す。** 画面から来た「体験あり」を信じない。
 */

type Body = {
  /** 対象外の確認で「有料で始める」を押したか */
  paid?: unknown;
  /** Stripe の画面で「戻る」を押したときに戻す先（/admin 配下だけ受け付ける） */
  returnTo?: unknown;
};

function safeReturnPath(value: unknown): string {
  return typeof value === "string" && /^\/admin(\/[\w\-/]*)?(\?[\w=&-]*)?$/.test(value) ? value : "/admin/settings/billing";
}

export async function POST(req: Request) {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }

  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const wantsPaid = body.paid === true;
  const returnPath = safeReturnPath(body.returnTo);

  try {
    const stripe = getStripe();
    const customer = await ensureStripeCustomer(tenant);

    // ── 二重契約を防ぐ（2026-08-24 追加）────────────────────
    // DB の値は Stripe からの通知で入るため、届いていない・遅れている間は「契約が無い」ように見える。
    // **Stripe 側を正として確かめる。** 見つかったら DB に書き戻して画面も回復させる。
    const live = await findLiveSubscription(customer);
    if (live) {
      await syncTenantFromSubscription(createSupabaseAdminClient(), tenant.tenantId, live);
      return NextResponse.json({ error: "すでにご契約済みです。変更はお支払い方法の画面から行えます。" }, { status: 409 });
    }

    const quota = await tenantQuota(tenant.tenantId);
    const prior = await precheckTrial(tenant.tenantId, tenant.email);
    const origin = appOrigin(req);

    if (prior && !wantsPaid) {
      // 前に無料体験をしていた。**ここでは画面を作らない。** 理由と金額を見せて選んでもらう
      return NextResponse.json({ needsPaidConfirmation: true, reason: prior.kind, quote: await quoteMonthly(quota) }, { status: 409 });
    }

    const session = prior
      ? // 体験なしで始める。今日の分を請求する
        await stripe.checkout.sessions.create({
          mode: "subscription",
          customer,
          line_items: subscriptionItems(quota).map((item) => ({ ...item, tax_rates: [STRIPE_TAX_RATE_ID] })),
          metadata: { tenant_id: tenant.tenantId },
          subscription_data: { metadata: { tenant_id: tenant.tenantId } },
          success_url: `${origin}/admin/settings/billing?started=paid`,
          cancel_url: `${origin}${returnPath}`,
          locale: "ja",
          // Managed Payments は使わない（2026-08-24 天真の決定。販売事業者は株式会社UTUTU のまま）。
          // **アカウント側の既定が「有効」なので、ここで明示的に切る必要がある**（切らないと決済を作れない）
          managed_payments: { enabled: false },
        })
      : // 体験あり。カードを預かるだけ（今日の請求は0円）。契約は戻り先で指紋を見てから作る
        await stripe.checkout.sessions.create({
          mode: "setup",
          customer,
          // setup モードで支払い方法の種類を指定しないときは、通貨が要る（支払い方法の種類は渡さない。§1-1）
          currency: "jpy",
          metadata: { tenant_id: tenant.tenantId },
          setup_intent_data: { metadata: { tenant_id: tenant.tenantId } },
          success_url: `${origin}/api/admin/billing/return?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${returnPath}`,
          locale: "ja",
        });

    if (!session.url) throw new Error("Checkout セッションのURLが返らなかった");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    // 画面には理由を出さない（利用者が対処できる情報ではないため）。
    // ただし原因を追えるよう、サーバーログには必ず残す（Vercel のログで見られる）
    console.error("[billing] checkout セッションの作成に失敗", error);
    return NextResponse.json({ error: "お支払いの画面を開けませんでした。もう一度お試しください。" }, { status: 500 });
  }
}
