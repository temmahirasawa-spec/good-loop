import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { SettingsNotificationsView } from "@/components/admin/SettingsNotificationsView";
import { StoreSwitchTabs } from "@/components/admin/StoreSwitchTabs";

// 保存直後に古い値が出ないよう、毎リクエスト取得する
export const dynamic = "force-dynamic";

/**
 * 設定（通知） Figma node 73:1329 PC / 75:1752 SP。
 *
 * 2026-08-24、**低評価アラートを実際に動かせるようにした**（supabase/0015）。
 * 通知は**店舗ごと**の設定なので、アンケート項目・ブランドと同じく店舗タブで切り替える。
 */
export default async function SettingsNotificationsPage({ searchParams }: { searchParams: { store?: string } }) {
  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);
  if (!store) return null;

  return (
    <>
      <StoreSwitchTabs stores={stores} selectedId={store.id} />
      <SettingsNotificationsView
        // 店舗を切り替えたら作り直す（useState の初期値は初回描画にしか効かないため）
        key={store.id}
        storeId={store.id}
        storeName={store.name}
        initialNotifyLowRating={store.notify_low_rating}
        initialNotifyEmail={store.notify_email ?? ""}
      />
    </>
  );
}
