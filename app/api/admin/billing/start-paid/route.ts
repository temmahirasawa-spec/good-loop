import { NextResponse } from "next/server";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { getTenantBilling } from "@/lib/billing/server";
import { startPaidSubscription } from "@/lib/billing/subscribe";

/**
 * 対象外の確認で「有料で始める」を押したとき（docs/specs/billing.md §3-3 の5）。
 *
 * カードを預かったあとで「このカードは前に無料体験をしていた」と分かった人が対象。
 * 預かったカードで、体験なしの契約を作り、今日の分を請求する。
 * **この画面で押したときだけ請求する**（黙って請求しない。§3-4）。
 */

export async function POST() {
  if (!STRIPE_ENABLED) {
    return NextResponse.json({ error: "お支払いの準備が整っていません。担当者にお問い合わせください。" }, { status: 503 });
  }
  const tenant = await getTenantBilling();
  if (!tenant) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await startPaidSubscription(tenant.tenantId);
    switch (result.kind) {
      case "started":
        return NextResponse.json({ ok: true });
      case "requires_action":
        // カードの会社が本人確認を求めた。Stripe の請求書の画面で済ませてもらう
        return NextResponse.json({ ok: true, invoiceUrl: result.invoiceUrl });
      case "no_card":
        return NextResponse.json({ error: "お支払いのカードが見つかりませんでした。もう一度カードを登録してください。" }, { status: 409 });
    }
  } catch (error) {
    console.error("[billing] 有料での開始に失敗", error);
    return NextResponse.json({ error: "お支払いに失敗しました。カードの状態をご確認ください。" }, { status: 500 });
  }
}
