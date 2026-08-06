import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 店舗ごとに編集できるアンケート項目（launch-plan.md 決定②、supabase/0005参照）。
 *
 * お客様側フロー（app/r/[storeSlug]/page.tsx、admin client）と、
 * 設定（アンケート項目）画面（session client）の両方から呼ばれるため、
 * クライアントの種類を問わない `SupabaseClient` を受け取る。
 */

export type StoreTagCategory = "good" | "improve";
export type StoreTag = { id: string; label: string; category: StoreTagCategory; sortOrder: number };

type StoreTagRow = { id: string; label: string; category: StoreTagCategory; sort_order: number };
type PresetRow = { label: string; category: StoreTagCategory; sort_order: number };

/**
 * 店舗の store_tags を返す。1件も無い（初回アクセス）場合は tags_master の
 * プリセットをコピーして種をまいてから返す。`unique(store_id, category, label)` があるため、
 * 同時アクセスで二重に呼ばれても重複行にはならない（後勝ちは無視され、既存行を読み直す）。
 */
export async function getOrSeedStoreTags(supabase: SupabaseClient, storeId: string, tenantId: string): Promise<StoreTag[]> {
  const existing = await fetchStoreTags(supabase, storeId);
  if (existing.length > 0) return existing;

  const { data: presets } = await supabase
    .from("tags_master")
    .select("label, category, sort_order")
    .order("category")
    .order("sort_order")
    .returns<PresetRow[]>();
  if (!presets || presets.length === 0) return [];

  await supabase
    .from("store_tags")
    .upsert(
      presets.map((p) => ({ tenant_id: tenantId, store_id: storeId, label: p.label, category: p.category, sort_order: p.sort_order })),
      { onConflict: "store_id,category,label", ignoreDuplicates: true }
    );

  return fetchStoreTags(supabase, storeId);
}

async function fetchStoreTags(supabase: SupabaseClient, storeId: string): Promise<StoreTag[]> {
  const { data, error } = await supabase
    .from("store_tags")
    .select("id, label, category, sort_order")
    .eq("store_id", storeId)
    .order("category")
    .order("sort_order")
    .returns<StoreTagRow[]>();
  // TODO(debug-temp): 本番でstore_tagsが空配列になる原因調査のための一時ログ。原因判明後に削除する
  if (error) console.error("[fetchStoreTags] error", JSON.stringify(error), "storeId=", storeId);
  else console.log("[fetchStoreTags] ok", "storeId=", storeId, "count=", data?.length);
  return (data ?? []).map((t) => ({ id: t.id, label: t.label, category: t.category, sortOrder: t.sort_order }));
}

export function byCategory(tags: StoreTag[], category: StoreTagCategory): string[] {
  return tags.filter((t) => t.category === category).map((t) => t.label);
}

/** 設定（アンケート項目）「プリセットに戻す」の参照元 */
export async function getTagPresets(supabase: SupabaseClient): Promise<{ good: string[]; improve: string[] }> {
  const { data } = await supabase.from("tags_master").select("label, category, sort_order").order("category").order("sort_order").returns<PresetRow[]>();
  const presets = data ?? [];
  return {
    good: presets.filter((p) => p.category === "good").map((p) => p.label),
    improve: presets.filter((p) => p.category === "improve").map((p) => p.label),
  };
}
