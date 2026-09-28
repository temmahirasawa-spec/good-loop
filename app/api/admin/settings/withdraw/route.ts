import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { findLiveSubscription } from "@/lib/billing/subscribe";

/**
 * 退会（設定・アカウント、Figma node 75:1449 PC / 76:1736 SP）の実行先。
 *
 * WithdrawModalの文言（「回答データ・集計はすべて削除され、復元できません」）どおり、
 * tenants行を削除する。stores/survey_responses/response_tags/ai_draft_logs/
 * conversion_events/page_views/store_tags は supabase/0002・0004・0005 で
 * `on delete cascade` を設定済みのため、tenantsを消せば自動的に連鎖して消える。
 *
 * tenant_id はリクエストボディではなく、ログイン中セッションのapp_metadataから取る
 * （他テナントのIDを渡されて削除されることを防ぐため）。削除後はAuthユーザー自体も
 * 削除し、二度とログインできないようにする（admin clientでしかできない操作）。
 *
 * ⚠ **先に Stripe の契約をその場で解約する**（2026-09-28。docs/specs/billing.md §12 の2）。
 *   以前は契約先とユーザーを消すだけで、**退会したあとも請求が続いていた。**
 *   解約に失敗したら退会を止めて理由を出す（アカウントだけ消えて請求が残る事故を防ぐ）。
 *   2回目の無料体験の記録（trial_claims）はどの契約先にも属さないので、退会しても残る（§3-4）。
 */
export async function POST() {
  const sessionClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  if (STRIPE_ENABLED) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenantId)
      .maybeSingle<{ stripe_customer_id: string | null }>();
    if (tenant?.stripe_customer_id) {
      try {
        const live = await findLiveSubscription(tenant.stripe_customer_id);
        // 期間の終わりを待たずに、今この場で解約する（日割りの返金はしない）
        if (live) await getStripe().subscriptions.cancel(live.id);
      } catch (error) {
        console.error("[withdraw] Stripe の契約の解約に失敗", error);
        return NextResponse.json(
          { error: "ご契約の解約ができなかったため、退会を中止しました。時間をおいてもう一度お試しください。" },
          { status: 502 },
        );
      }
    }
  }

  const { error: deleteError } = await admin.from("tenants").delete().eq("id", tenantId);
  if (deleteError) {
    return NextResponse.json({ error: "failed to delete tenant" }, { status: 500 });
  }

  await admin.auth.admin.deleteUser(user.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
