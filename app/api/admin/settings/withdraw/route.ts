import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const { error: deleteError } = await admin.from("tenants").delete().eq("id", tenantId);
  if (deleteError) {
    return NextResponse.json({ error: "failed to delete tenant" }, { status: 500 });
  }

  await admin.auth.admin.deleteUser(user.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
