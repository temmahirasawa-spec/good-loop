import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { byCategory, getAllTagPresets, getOrSeedStoreTags } from "@/lib/store-tags";
import { SettingsSurveyView } from "@/components/admin/SettingsSurveyView";
import { StoreSwitchTabs } from "@/components/admin/StoreSwitchTabs";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/**
 * 設定（アンケート項目） Figma node 73:1294 PC / 75:1699 SP。
 *
 * 2026-08-21、**店舗ごとに設定できるようにした**（天真の依頼）。
 * 対象の店舗は URL の `?store=<店舗ID>` で選ぶ（StoreSwitchTabs）。指定が無ければ最初の店舗。
 * プリセットは業態別（supabase/0010、launch-plan.md 4-B）。2026-08-22、天真の依頼で
 * 「プリセットに戻す」を業態のドロップダウンに差し替えたため、9業態ぶんをまとめて渡す。
 */
export default async function SettingsSurveyPage({ searchParams }: { searchParams: { store?: string } }) {
  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);
  if (!store) return null;

  const supabase = await createSupabaseServerClient();
  const [storeTags, presets] = await Promise.all([
    getOrSeedStoreTags(supabase, store.id, store.tenant_id, store.business_category),
    getAllTagPresets(supabase),
  ]);

  return (
    <>
      <StoreSwitchTabs stores={stores} selectedId={store.id} />
      <SettingsSurveyView
        // 店舗を切り替えたら、前の店舗のタグが残らないよう作り直す（useStateの初期値は初回描画にしか効かないため）
        key={store.id}
        storeId={store.id}
        storeName={store.name}
        businessCategory={store.business_category}
        initialGoodTags={byCategory(storeTags, "good")}
        initialImproveTags={byCategory(storeTags, "improve")}
        presets={presets}
      />
    </>
  );
}
