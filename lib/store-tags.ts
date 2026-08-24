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
export async function getOrSeedStoreTags(
  supabase: SupabaseClient,
  storeId: string,
  tenantId: string,
  businessCategory: string
): Promise<StoreTag[]> {
  const existing = await fetchStoreTags(supabase, storeId);
  if (existing.length > 0) return existing;

  const presets = await fetchPresetRows(supabase, businessCategory);
  if (presets.length === 0) return [];

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
    // アーカイブ済み（supabase/0016）は来店客にも設定画面にも出さない。
    // 過去の集計だけが残る（集計画面は archived も読む。lib/admin/queries.ts）
    .is("archived_at", null)
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

/**
 * 設定（アンケート項目）のプリセット参照元。店舗の業態に対応する1組だけを返す。
 */
export async function getTagPresets(supabase: SupabaseClient, businessCategory: string): Promise<TagPreset> {
  return toPreset(await fetchPresetRows(supabase, businessCategory));
}

export type TagPreset = { good: string[]; improve: string[] };

/**
 * 全業態のプリセットをまとめて返す（2026-08-22、設定（アンケート項目）の業態ドロップダウン用）。
 *
 * 画面側で業態を選ぶたびにサーバーへ問い合わせると1テンポ遅れるため、9業態ぶん（99行）を
 * 最初にまとめて渡してしまう。テキストだけの小さなデータなので転送量の問題にならない。
 */
export async function getAllTagPresets(supabase: SupabaseClient): Promise<Record<string, TagPreset>> {
  const { data } = await supabase
    .from("tags_master")
    .select("business_category, label, category, sort_order")
    .order("category")
    .order("sort_order")
    .returns<(PresetRow & { business_category: string })[]>();

  const byCategory: Record<string, PresetRow[]> = {};
  for (const row of data ?? []) {
    (byCategory[row.business_category] ??= []).push(row);
  }

  const out: Record<string, TagPreset> = {};
  for (const [slug, rows] of Object.entries(byCategory)) out[slug] = toPreset(rows);
  return out;
}

function toPreset(presets: PresetRow[]): TagPreset {
  return {
    good: presets.filter((p) => p.category === "good").map((p) => p.label),
    improve: presets.filter((p) => p.category === "improve").map((p) => p.label),
  };
}

/**
 * tags_master から、その業態のプリセットを並び順で取り出す（supabase/0010）。
 *
 * tags_master は全店舗共通のマスタ表で、業態ごとに1組ずつ入っている。
 * 業態の値が想定外（＝マスタに1組も無い）の場合は空を返す。
 * 店舗のアンケート項目が空になるだけで、来店客の画面は自由記述で成立する。
 */
async function fetchPresetRows(supabase: SupabaseClient, businessCategory: string): Promise<PresetRow[]> {
  const { data } = await supabase
    .from("tags_master")
    .select("label, category, sort_order")
    .eq("business_category", businessCategory)
    .order("category")
    .order("sort_order")
    .returns<PresetRow[]>();
  return data ?? [];
}
