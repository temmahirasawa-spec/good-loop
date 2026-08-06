import { getCurrentStore } from "@/lib/admin/current-store";
import { SettingsBrandView } from "@/components/admin/SettingsBrandView";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/** 設定（ブランドとテーマ） Figma node 69:1261 PC / 75:1613 SP */
export default async function SettingsBrandPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  return (
    <SettingsBrandView
      storeId={store.id}
      tenantId={store.tenant_id}
      initialName={store.name}
      initialTheme={store.loop_theme}
      initialLogoUrl={store.logo_url}
    />
  );
}
