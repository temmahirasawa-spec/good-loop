import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 設定画面が対象にする店舗の取得。
 *
 * 2026-08-21以前は「テナントの最初の1店舗」だけを返していた（店舗を選ぶUIがFigmaに
 * 無く、1テナント1店舗の前提だったため）。実際には1テナントが複数店舗を持つ運用に
 * なっており、設定（アンケート項目）・（ブランドとテーマ）が最初の1店舗しか
 * 編集できない不具合になっていた。天真の依頼により、店舗を選べるようにした
 * （画面上部の店舗タブ = components/admin/StoreSwitchTabs.tsx）。
 *
 * RLSでテナント分離されるため、ログイン中ユーザーからは自分のテナントの店舗しか返らない。
 */

export type SettingsStore = {
  id: string;
  tenant_id: string;
  name: string;
  loop_theme: string;
  business_category: string;
  logo_url: string | null;
};

/** ログイン中テナントの全店舗（作成順）。未ログインなら空 */
export async function getSettingsStores(): Promise<SettingsStore[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("stores")
    .select("id, tenant_id, name, loop_theme, business_category, logo_url")
    .order("created_at")
    .returns<SettingsStore[]>();

  return data ?? [];
}

/**
 * URLの `?store=<id>` で指定された店舗を選ぶ。
 * 指定が無い・他テナントのIDを入れられた等で見つからない場合は最初の店舗にフォールバックする
 * （URLを直接書き換えられても他店舗の設定は開けない。RLSで一覧自体が絞られているため）。
 */
export function selectStore(stores: SettingsStore[], storeId?: string): SettingsStore | null {
  if (stores.length === 0) return null;
  return stores.find((s) => s.id === storeId) ?? stores[0];
}

/** 店舗名の表示など、1店舗だけあればよい場所から使う（管理画面レイアウトのサイドバー） */
export async function getCurrentStore(): Promise<SettingsStore | null> {
  const stores = await getSettingsStores();
  return stores[0] ?? null;
}
