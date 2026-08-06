import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/admin/current-store";
import { byCategory, getOrSeedStoreTags, getTagPresets } from "@/lib/store-tags";
import { SettingsSurveyView } from "@/components/admin/SettingsSurveyView";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/**
 * 設定（アンケート項目） Figma node 73:1294 PC / 75:1699 SP。
 *
 * プリセットは業態別ではなく tags_master 全体を参照している（現状 tags_master は
 * 飲食店の語彙のみで、業態別プリセットのテーブルはまだ無い。launch-plan.md 4-B参照）。
 */
export default async function SettingsSurveyPage() {
  const store = await getCurrentStore();
  if (!store) return null;

  const supabase = await createSupabaseServerClient();
  const [storeTags, presets] = await Promise.all([getOrSeedStoreTags(supabase, store.id, store.tenant_id), getTagPresets(supabase)]);

  return (
    <SettingsSurveyView
      storeId={store.id}
      initialGoodTags={byCategory(storeTags, "good")}
      initialImproveTags={byCategory(storeTags, "improve")}
      presetGoodTags={presets.good}
      presetImproveTags={presets.improve}
    />
  );
}
