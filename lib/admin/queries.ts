import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routeRate } from "./metrics";
import type { ResponseItem, StoreSummary } from "./types";

/**
 * 管理画面のデータ取得（launch-plan.md フェーズ4）。
 *
 * ⚠ 管理画面にはまだログイン（Supabase Auth）が無い（launch-plan.md フェーズ5で着手）。
 * そのため「ログイン中のテナント」を判定できず、admin client（service_role・RLSを迂回）で
 * 見えている店舗を全件そのまま出している。現状はテナントが1つ（YORKYS BRUNCH）しか無いため
 * 実害は無いが、認証を実装するときは必ずここを「ログイン中の tenant_id で絞り込む」形に直すこと。
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weeksAgoIso(weeks: number): string {
  return new Date(Date.now() - weeks * WEEK_MS).toISOString();
}

function inWindow(iso: string, startMs: number, endMs: number): boolean {
  const t = new Date(iso).getTime();
  return t >= startMs && t < endMs;
}

function formatDateLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

type StoreRow = { id: string; name: string; slug: string; loop_theme: string; google_place_id: string | null };
type ResponseRow = { store_id: string; rating: number; created_at: string };
type EventRow = { store_id: string; created_at: string };
type ViewRow = { store_id: string; created_at: string };

/** トップ・店舗詳細・二次元コード発行・店舗管理で共有する店舗ごとの集計 */
export async function getStoreSummaries(): Promise<StoreSummary[]> {
  const supabase = createSupabaseAdminClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, slug, loop_theme, google_place_id")
    .order("name")
    .returns<StoreRow[]>();
  if (!stores || stores.length === 0) return [];

  const storeIds = stores.map((s) => s.id);
  const since5w = weeksAgoIso(5);

  const [{ data: responses }, { data: events }, { data: views }] = await Promise.all([
    supabase.from("survey_responses").select("store_id, rating, created_at").in("store_id", storeIds).returns<ResponseRow[]>(),
    supabase
      .from("conversion_events")
      .select("store_id, created_at")
      .eq("event_type", "opened_google")
      .in("store_id", storeIds)
      .gte("created_at", since5w)
      .returns<EventRow[]>(),
    supabase.from("page_views").select("store_id, created_at").in("store_id", storeIds).gte("created_at", weeksAgoIso(2)).returns<ViewRow[]>(),
  ]);

  const now = Date.now();
  const currentStart = now - WEEK_MS;
  const prevStart = now - 2 * WEEK_MS;

  return stores.map((store) => {
    const storeResponses = (responses ?? []).filter((r) => r.store_id === store.id);
    const storeEvents = (events ?? []).filter((e) => e.store_id === store.id);
    const storeViews = (views ?? []).filter((v) => v.store_id === store.id);

    const responseCount = storeResponses.filter((r) => inWindow(r.created_at, currentStart, now)).length;
    const responseCountPrev = storeResponses.filter((r) => inWindow(r.created_at, prevStart, currentStart)).length;
    const routeCount = storeEvents.filter((e) => inWindow(e.created_at, currentStart, now)).length;
    const routeCountPrev = storeEvents.filter((e) => inWindow(e.created_at, prevStart, currentStart)).length;
    const qrReads = storeViews.filter((v) => inWindow(v.created_at, currentStart, now)).length;
    const qrReadsPrev = storeViews.filter((v) => inWindow(v.created_at, prevStart, currentStart)).length;

    const routeRatePercent = routeRate(routeCount, responseCount);
    const prevRoutePercent = routeRate(routeCountPrev, responseCountPrev);
    const routeRateDeltaPt = routeRatePercent === null || prevRoutePercent === null ? null : routeRatePercent - prevRoutePercent;

    const avgRating = storeResponses.length === 0 ? 0 : storeResponses.reduce((sum, r) => sum + r.rating, 0) / storeResponses.length;

    // 直近5週。i=0が5週前、i=4が今週
    const trend = Array.from({ length: 5 }, (_, i) => {
      const weeksAgo = 4 - i;
      const start = now - (weeksAgo + 1) * WEEK_MS;
      const end = now - weeksAgo * WEEK_MS;
      return storeEvents.filter((e) => inWindow(e.created_at, start, end)).length;
    });

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      loopTheme: store.loop_theme,
      routeCount,
      routeCountPrev,
      routeRatePercent,
      routeRateDeltaPt,
      responseCount,
      responseCountPrev,
      avgRating,
      trend,
      googlePlaceLinked: store.google_place_id !== null,
      qrReads,
      qrReadsPrev,
    } satisfies StoreSummary;
  });
}

export async function getStoreSummary(storeId: string): Promise<StoreSummary | null> {
  const stores = await getStoreSummaries();
  return stores.find((s) => s.id === storeId) ?? null;
}

type ResponseWithJoinsRow = {
  id: string;
  store_id: string;
  rating: number;
  free_text: string | null;
  created_at: string;
  stores: { name: string } | null;
  response_tags: { tags_master: { label: string } | null }[] | null;
  conversion_events: { event_type: string }[] | null;
};

/** 回答一覧・店舗詳細「直近の回答」で共有する回答データ */
export async function getResponseItems(options: { storeId?: string; limit?: number } = {}): Promise<ResponseItem[]> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("survey_responses")
    .select(
      "id, store_id, rating, free_text, created_at, stores(name), response_tags(tags_master(label)), conversion_events(event_type)"
    )
    .order("created_at", { ascending: false });
  if (options.storeId) query = query.eq("store_id", options.storeId);
  if (options.limit) query = query.limit(options.limit);

  const { data } = await query.returns<ResponseWithJoinsRow[]>();
  if (!data) return [];

  return data.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    storeName: r.stores?.name ?? "",
    rating: r.rating,
    dateLabel: formatDateLabel(r.created_at),
    routeStatus: (r.conversion_events ?? []).some((e) => e.event_type === "opened_google") ? "guided" : "store-only",
    tags: (r.response_tags ?? []).map((rt) => rt.tags_master?.label).filter((label): label is string => Boolean(label)),
    freeText: r.free_text ?? undefined,
  }));
}
