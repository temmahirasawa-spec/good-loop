import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routeRate } from "./metrics";
import type { ResponseItem, StoreSummary } from "./types";

/**
 * 管理画面のデータ取得（launch-plan.md フェーズ5でログイン中tenant_idの絞り込みに切り替え済み）。
 *
 * admin client（service_role・RLSを迂回）ではなく、ログイン中ユーザーのCookieセッションを
 * 積んだクライアントを使う。これにより supabase/0002_tenants_and_rls.sql のRLSポリシーが
 * そのまま効き、「ログイン中の tenant_id の行しか返らない」がコード側の絞り込み漏れに関係なく保証される。
 * `/admin` 配下は middleware.ts が未ログイン時に弾くため、ここに来る時点でセッションは必ず存在する。
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

/**
 * 回答一覧の期間フィルタ（launch-plan.md D-8）。「今月」だけはJST（Asia/Tokyo）の暦月で区切る。
 *
 * 2026-08-22、任意の期間（`from`〜`to`）にも対応した（UI検証Q9）。
 * 日付は「YYYY-MM-DD」で受け取り、JSTのその日の00:00〜翌日00:00で挟む。
 */
export function rangeToIso(range?: { from?: string; to?: string }): { since?: string; until?: string } {
  if (!range?.from && !range?.to) return {};
  const dayStart = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString();
  const dayEnd = (d: string) => new Date(new Date(`${d}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return {
    since: range.from ? dayStart(range.from) : undefined,
    until: range.to ? dayEnd(range.to) : undefined,
  };
}

function periodSinceIso(period?: "7d" | "14d" | "month" | "90d"): string | undefined {
  if (!period) return undefined;
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  if (period === "7d") return new Date(now - 7 * DAY_MS).toISOString();
  if (period === "14d") return new Date(now - 14 * DAY_MS).toISOString();
  if (period === "90d") return new Date(now - 90 * DAY_MS).toISOString();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(new Date(now));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return new Date(`${year}-${month}-01T00:00:00+09:00`).toISOString();
}

type StoreRow = { id: string; name: string; slug: string; loop_theme: string; business_category: string; google_place_id: string | null };
type ResponseRow = { store_id: string; rating: number; created_at: string };
type EventRow = { store_id: string; created_at: string };
type ViewRow = { store_id: string; created_at: string };

/** トップ・店舗詳細・二次元コード発行・店舗管理で共有する店舗ごとの集計 */
export async function getStoreSummaries(): Promise<StoreSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, slug, loop_theme, business_category, google_place_id")
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
      businessCategory: store.business_category,
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
  response_tags: { store_tags: { label: string } | null }[] | null;
  conversion_events: { event_type: string }[] | null;
};

/** 回答一覧・店舗詳細「直近の回答」で共有する回答データ */
export async function getResponseItems(
  options: {
    storeId?: string;
    limit?: number;
    /** 個別の星評価（1〜5）。良かった点／改善点の粗い分岐は branch を使う */
    rating?: number;
    /** ★4以上＝good・★3以下＝improve（rating-flow.md A-2の分岐と同じ） */
    branch?: "good" | "improve";
    period?: "7d" | "14d" | "month" | "90d";
    /** 任意の期間（YYYY-MM-DD）。指定されていれば period より優先する */
    from?: string;
    to?: string;
  } = {}
): Promise<ResponseItem[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("survey_responses")
    .select(
      "id, store_id, rating, free_text, created_at, stores(name), response_tags(store_tags(label)), conversion_events(event_type)"
    )
    .order("created_at", { ascending: false });
  if (options.storeId) query = query.eq("store_id", options.storeId);
  if (options.rating) query = query.eq("rating", options.rating);
  if (options.branch) query = query.eq("branch", options.branch);
  const custom = rangeToIso({ from: options.from, to: options.to });
  const since = custom.since ?? (options.from || options.to ? undefined : periodSinceIso(options.period));
  if (since) query = query.gte("created_at", since);
  if (custom.until) query = query.lt("created_at", custom.until);
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
    tags: (r.response_tags ?? []).map((rt) => rt.store_tags?.label).filter((label): label is string => Boolean(label)),
    freeText: r.free_text ?? undefined,
  }));
}

/* ────────────────────────────────────────────────────────────────
 * 集計（アンケート項目ごと）— docs/specs/analytics.md
 * ──────────────────────────────────────────────────────────────── */

export type TagAggregate = {
  /** アーカイブ済みか（supabase/0016）。現役の項目一覧には出ないが、過去の集計として残る */
  archived: boolean;
  tagId: string;
  label: string;
  category: "good" | "improve";
  /** その項目が選ばれた回数 */
  count: number;
  /** 同じ分岐の回答数に対する割合（％）。分母が0のときは null */
  percent: number | null;
};

export type TagAggregates = {
  good: TagAggregate[];
  improve: TagAggregate[];
  /** 割合の分母。良かった点＝★4〜5、改善点＝★1〜3（語彙が違うので分母を混ぜない） */
  goodResponseCount: number;
  improveResponseCount: number;
  responseCount: number;
  /**
   * 期間を無視した、その店舗の全回答数。
   * 「まだ回答がありません（0件）」と「この期間の回答はありません」を区別するために使う。
   */
  responseCountAllTime: number;
};

type StoreTagRow = { id: string; label: string; category: "good" | "improve"; sort_order: number; archived_at: string | null };
type BranchRow = { id: string; branch: "good" | "improve" };
type ResponseTagRow = { tag_id: string; response_id: string };

/**
 * 1店舗ぶんの、アンケート項目ごとの集計。
 *
 * 店舗ごとに項目（store_tags）が違うため、**複数店舗をまたいで合計しない**
 * （「料理・味」と「味」は別項目なので、横並びに足すと別物を合算してしまう）。
 * docs/specs/analytics.md 1章の決定。
 *
 * 新しいSQLは要らない。survey_responses × response_tags × store_tags の結合で出せる。
 * RLSはログイン中セッションのクライアントが担保する（このファイル冒頭のコメント参照）。
 */
export async function getTagAggregates(options: {
  storeId: string;
  period?: "7d" | "14d" | "month" | "90d";
  from?: string;
  to?: string;
}): Promise<TagAggregates> {
  const supabase = await createSupabaseServerClient();

  const custom = rangeToIso({ from: options.from, to: options.to });
  const since = custom.since ?? (options.from || options.to ? undefined : periodSinceIso(options.period));

  let responseQuery = supabase.from("survey_responses").select("id, branch").eq("store_id", options.storeId);
  if (since) responseQuery = responseQuery.gte("created_at", since);
  if (custom.until) responseQuery = responseQuery.lt("created_at", custom.until);

  const [{ data: tags }, { data: responses }, { count: allTime }] = await Promise.all([
    supabase
      .from("store_tags")
      // アーカイブ済みも読む。過去の集計を「受付終了」として残すため（supabase/0016）
      .select("id, label, category, sort_order, archived_at")
      .eq("store_id", options.storeId)
      .order("sort_order")
      .returns<StoreTagRow[]>(),
    responseQuery.returns<BranchRow[]>(),
    supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("store_id", options.storeId),
  ]);

  const responseIds = (responses ?? []).map((r) => r.id);
  const { data: links } = responseIds.length
    ? await supabase.from("response_tags").select("tag_id, response_id").in("response_id", responseIds).returns<ResponseTagRow[]>()
    : { data: [] as ResponseTagRow[] };

  const counts = new Map<string, number>();
  for (const link of links ?? []) counts.set(link.tag_id, (counts.get(link.tag_id) ?? 0) + 1);

  const goodResponseCount = (responses ?? []).filter((r) => r.branch === "good").length;
  const improveResponseCount = (responses ?? []).filter((r) => r.branch === "improve").length;

  const toAggregate = (tag: StoreTagRow, denominator: number): TagAggregate => {
    const count = counts.get(tag.id) ?? 0;
    return {
      tagId: tag.id,
      label: tag.label,
      category: tag.category,
      archived: Boolean(tag.archived_at),
      count,
      percent: denominator === 0 ? null : Math.round((count / denominator) * 100),
    };
  };
  const byCountDesc = (a: TagAggregate, b: TagAggregate) => b.count - a.count;

  // アーカイブ済みは「その期間に回答が付いているときだけ」出す。
  // 0件のアーカイブ項目まで並べると、消したはずの項目がいつまでも残って見える
  const visible = (agg: TagAggregate) => !agg.archived || agg.count > 0;

  return {
    good: (tags ?? []).filter((t) => t.category === "good").map((t) => toAggregate(t, goodResponseCount)).filter(visible).sort(byCountDesc),
    improve: (tags ?? []).filter((t) => t.category === "improve").map((t) => toAggregate(t, improveResponseCount)).filter(visible).sort(byCountDesc),
    goodResponseCount,
    improveResponseCount,
    responseCount: responses?.length ?? 0,
    responseCountAllTime: allTime ?? 0,
  };
}
