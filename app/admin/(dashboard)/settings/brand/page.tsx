import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { SettingsBrandView } from "@/components/admin/SettingsBrandView";
import { StoreSwitchTabs } from "@/components/admin/StoreSwitchTabs";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/**
 * 設定（ブランドとテーマ） Figma node 69:1261 PC / 75:1613 SP。
 *
 * 2026-08-21、アンケート項目と同じく**店舗ごと**に設定できるようにした。
 * ロゴ・色テーマ・店舗名はもともと店舗ごとの値（stores 行）だが、
 * 画面が最初の1店舗しか開けなかったため、2店舗目以降を編集できなかった。
 */
export default async function SettingsBrandPage({ searchParams }: { searchParams: { store?: string } }) {
  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);
  if (!store) return null;

  return (
    <>
      <StoreSwitchTabs stores={stores} selectedId={store.id} />
      <SettingsBrandView
        // 店舗を切り替えたら入力状態を作り直す（前の店舗の店名・ロゴが残らないように）
        key={store.id}
        storeId={store.id}
        tenantId={store.tenant_id}
        initialName={store.name}
        initialTheme={store.loop_theme}
        initialLogoUrl={store.logo_url}
      />
    </>
  );
}
