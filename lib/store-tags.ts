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
 * 同時アクセスで二重に呼ばれても重複行にはならない（後勝ちは無視される）。
 *
 * 2026-08-06、初回アクセス時にタグが1件も表示されない不具合の原因が判明した：
 * upsert直後に別クエリで再読み込みすると、Supabaseの接続プーリング（PgBouncer）越しに
 * 別のDB接続が使われることがあり、「自分が今書き込んだ行」がまだ見えない状態で
 * 読んでしまうことがあった（読み取り一貫性が保証されない）。
 * upsertの`.select()`レスポンスをそのまま使えば、書き込みと同じレスポンスなので
 * 必ず反映済みの内容が返る。これを正として使い、再読み込みはしない。
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

  const { data: inserted } = await supabase
    .from("store_tags")
    .upsert(
      presets.map((p) => ({ tenant_id: tenantId, store_id: storeId, label: p.label, category: p.category, sort_order: p.sort_order })),
      { onConflict: "store_id,category,label", ignoreDuplicates: true }
    )
    .select("id, label, category, sort_order")
    .returns<StoreTagRow[]>();

  if (inserted && inserted.length > 0) {
    return toStoreTags(inserted).sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder);
  }

  // 同時アクセスで他リクエストが先に種まきした場合など、insertedが空になるケースの保険
  return fetchStoreTags(supabase, storeId);
}

async function fetchStoreTags(supabase: SupabaseClient, storeId: string): Promise<StoreTag[]> {
  const { data } = await supabase
    .from("store_tags")
    .select("id, label, category, sort_order")
    .eq("store_id", storeId)
    .order("category")
    .order("sort_order")
    .returns<StoreTagRow[]>();
  return toStoreTags(data ?? []);
}

function toStoreTags(rows: StoreTagRow[]): StoreTag[] {
  return rows.map((t) => ({ id: t.id, label: t.label, category: t.category, sortOrder: t.sort_order }));
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
