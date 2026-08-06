import { SettingsStoresView } from "@/components/admin/SettingsStoresView";
import { getStoreSummaries } from "@/lib/admin/queries";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/** 設定（店舗管理） Figma node 73:1364 PC / 75:1803 SP */
export default async function SettingsStoresPage() {
  const stores = await getStoreSummaries();
  return <SettingsStoresView stores={stores.map((s) => ({ id: s.id, name: s.name, googlePlaceLinked: s.googlePlaceLinked }))} />;
}
