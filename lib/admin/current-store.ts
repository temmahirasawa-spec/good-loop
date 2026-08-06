import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * ログイン中テナントの「主となる店舗」を返す。
 *
 * 設定（ブランドとテーマ／アンケート項目）は店舗を選ぶUIがFigmaに無く、
 * 現状どのテナントも店舗を1つしか持たない（launch-plan.md③）前提で、
 * テナントの最初の店舗を対象にしている。複数店舗を持つテナントが増えたら
 * 店舗セレクタの追加とあわせてこの関数を見直すこと。
 */

type CurrentStoreRow = { id: string; tenant_id: string; name: string; loop_theme: string; logo_url: string | null };

export async function getCurrentStore(): Promise<CurrentStoreRow | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("stores")
    .select("id, tenant_id, name, loop_theme, logo_url")
    .order("created_at")
    .limit(1)
    .returns<CurrentStoreRow[]>();

  return data?.[0] ?? null;
}
