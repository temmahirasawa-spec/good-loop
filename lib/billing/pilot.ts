import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 試験導入中（無料）の契約先か（supabase/0018 の tenants.is_pilot。2026-10-01）。
 *
 * 招待コードで登録した契約先が true になる。true のあいだは、管理画面に
 * トライアルの残り日数・お支払いへの誘導を出さない（設定＞お支払いは「試験導入中（無料）」と出す）。
 *
 * **読めなかったときは false に倒す**（＝これまでどおりの表示）。
 *   - 0018 を実行する前（列が無い）でも、お支払い画面が壊れないようにするため
 *   - 逆に倒すと、通常の契約先に「試験導入中（無料）」と出て、払わなくてよいと誤解させてしまう
 *
 * `getBillingState`（lib/billing/state.ts）に混ぜずに別で読むのも同じ理由。
 * 1つの select に入れると、列が無いときに select 全体が失敗し、契約の状態まで「未接続」に見えてしまう。
 */
export async function isPilotTenant(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return false;

  const { data, error } = await supabase
    .from("tenants")
    .select("is_pilot")
    .eq("id", tenantId)
    .maybeSingle<{ is_pilot: boolean | null }>();

  if (error || !data) return false;
  return data.is_pilot === true;
}
