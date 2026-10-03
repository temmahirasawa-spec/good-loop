import { NextResponse } from "next/server";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { getTenantBilling } from "@/lib/billing/server";
import { finalizeCardSetup } from "@/lib/billing/subscribe";

/**
 * カードを預かった Stripe の画面（setup モード）からの戻り先（docs/specs/billing.md §3-3）。
 *
 * Webhook（checkout.session.completed）と**同じ処理を呼ぶ。** どちらが先に来ても結果は同じ。
 * 戻り先でも処理するのは、Webhook を待たずに「無料体験が始まりました」を出すため
 * （待つと、戻った直後の画面がまだ「カード未登録」のままに見える）。
 *
 * 戻す先の画面（体験の案内・対象外の確認）は、Figma の3案のどれに決まるかで変わる（2026-09-28 時点で選択待ち）。
 * ここでは結果を問い合わせの文字で渡すだけにしてある。
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);

  if (!STRIPE_ENABLED) return to("/admin/settings/billing");
  const tenant = await getTenantBilling();
  if (!tenant) return to("/admin/login");

  const sessionId = url.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) return to("/admin/settings/billing?card=error");

  try {
    const result = await finalizeCardSetup(sessionId, tenant.tenantId);
    switch (result.kind) {
      case "trial_started":
        return to("/admin?trial=started");
      case "already_subscribed":
        return to("/admin/settings/billing");
      case "needs_paid_confirmation":
        return to(`/admin/settings/billing?confirm=paid&reason=${result.prior.kind}`);
      case "not_completed":
        return to("/admin/settings/billing?card=incomplete");
    }
  } catch (error) {
    console.error("[billing] カード登録の後始末に失敗", error);
    return to("/admin/settings/billing?card=error");
  }
}
