/**
 * 管理画面の「はりぼて」用ダミーデータ。
 *
 * 2026-08-05、8/6の洋輔×天真MTGでのデモ用に、実データ接続の前段として画面だけ作った。
 * Supabaseプロジェクトができたら、この固定値をAPI Routeからのfetchに置き換えること
 * （お客様側フロー同様、コンポーネント自体はpropsでデータを受け取る形にしてあるので、
 * データの取得元を差し替えるだけで済む設計にしてある）。
 *
 * 数値・店舗名はすべてFigma（i7z9wGL6BpFoC2kwlGA1lV / 07 管理画面 / Dashboard）の
 * サンプル値をそのまま写した。
 */

export type StoreSummary = {
  id: string;
  name: string;
  /** Googleのクチコミ投稿画面へ送り出した数。実際に投稿されたかはGOOD LOOPからは分からない */
  routeCount: number;
  routeCountPrev: number;
  routeRatePercent: number | null;
  routeRateDeltaPt: number | null;
  responseCount: number;
  responseCountPrev: number;
  avgRating: number;
  /** 送客数の推移（直近5週）。末尾が今週＝routeCount と一致する */
  trend: number[];
  /** Googleマップ上の店舗と紐付け済みか（設定・店舗管理で使用） */
  googlePlaceLinked: boolean;
};

export const STORES: StoreSummary[] = [
  { id: "sannomiya", name: "三宮本店", routeCount: 38, routeCountPrev: 34, routeRatePercent: 61, routeRateDeltaPt: 2, responseCount: 62, responseCountPrev: 58, avgRating: 4.4, trend: [31, 35, 30, 33, 38], googlePlaceLinked: true },
  { id: "umeda", name: "梅田うめきた店", routeCount: 12, routeCountPrev: 27, routeRatePercent: 29, routeRateDeltaPt: -32, responseCount: 41, responseCountPrev: 44, avgRating: 3.8, trend: [28, 32, 26, 30, 12], googlePlaceLinked: true },
  { id: "kobe-motomachi", name: "神戸元町店", routeCount: 34, routeCountPrev: 30, routeRatePercent: 62, routeRateDeltaPt: 3, responseCount: 55, responseCountPrev: 51, avgRating: 4.2, trend: [27, 29, 25, 29, 34], googlePlaceLinked: true },
  { id: "osaka-honmachi", name: "大阪本町店", routeCount: 2, routeCountPrev: 24, routeRatePercent: null, routeRateDeltaPt: null, responseCount: 3, responseCountPrev: 39, avgRating: 4.1, trend: [10, 4, 12, 6, 2], googlePlaceLinked: false },
  { id: "kyoto-shijo", name: "京都四条店", routeCount: 17, routeCountPrev: 15, routeRatePercent: 61, routeRateDeltaPt: 3, responseCount: 28, responseCountPrev: 26, avgRating: 4.0, trend: [14, 15, 13, 15, 17], googlePlaceLinked: true },
];

export type LoopTheme = {
  slug: string;
  label: string;
  /** app/design-tokens.css の accent/primary・accent/wash と同値（Figmaのスウォッチ実測） */
  swatchPrimary: string;
  swatchLight: string;
};

/**
 * 業態テーマ一覧（設定・ブランドとテーマ）。順序・値は Loop Theme の9モードと一致させる。
 *
 * このカードは9業態すべての色を同時に並べて見せる一覧であり、`--loop-accent-primary` 等は
 * アクティブな1業態の値しか持たない（app/design-tokens.css）。選択中でない8業態ぶんは、
 * その業態自身の色を出す必要があるため変数にバインドできない。値は Figma のスウォッチを
 * 実測したもので、app/design-tokens.css の該当モードと同値（design-qa-allow はこの理由で各行に付けてある）。
 */
export const LOOP_THEMES: LoopTheme[] = [
  { slug: "clinic", label: "クリニック", swatchPrimary: "#00c471", swatchLight: "#dff9ec" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "restaurant", label: "飲食店", swatchPrimary: "#e0552b", swatchLight: "#fceee7" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "salon", label: "美容室", swatchPrimary: "#a98a5c", swatchLight: "#f8f2e8" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "beauty", label: "エステ・美容", swatchPrimary: "#db6e8c", swatchLight: "#fcedf1" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "seikotsuin", label: "整骨院", swatchPrimary: "#2c6fb5", swatchLight: "#e8f1fa" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "fitness", label: "フィットネス", swatchPrimary: "#93c90f", swatchLight: "#f2fbdd" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "school", label: "スクール", swatchPrimary: "#efa71e", swatchLight: "#fef4e0" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "pet", label: "ペット", swatchPrimary: "#1fa5d6", swatchLight: "#e4f5fc" }, // design-qa-allow: 非アクティブ業態のプレビュー色
  { slug: "lodging-sauna", label: "宿泊・サウナ", swatchPrimary: "#2f6b54", swatchLight: "#e8f1ed" }, // design-qa-allow: 非アクティブ業態のプレビュー色
];

export const TREND_WEEK_LABELS = ["5週前", "4週前", "3週前", "2週前", "今週"];

/** 全店の送客数の推移（直近5週）。各週は STORES の同じ週の合計と一致する */
export const ALL_STORES_TREND = [110, 115, 106, 113, 103];

/** 送客率（％）。回答数が0のときは算出しない */
export function routeRate(routeCount: number, responseCount: number): number | null {
  if (responseCount === 0) return null;
  return Math.round((routeCount / responseCount) * 100);
}

export function totals(stores: StoreSummary[]) {
  const sum = (pick: (s: StoreSummary) => number) => stores.reduce((acc, s) => acc + pick(s), 0);
  const routeCount = sum((s) => s.routeCount);
  const routeCountPrev = sum((s) => s.routeCountPrev);
  const responseCount = sum((s) => s.responseCount);
  const responseCountPrev = sum((s) => s.responseCountPrev);
  return {
    routeCount,
    routeCountPrev,
    responseCount,
    responseCountPrev,
    routeRatePercent: routeRate(routeCount, responseCount),
    routeRatePercentPrev: routeRate(routeCountPrev, responseCountPrev),
  };
}

export type RouteStatus = "guided" | "store-only";

export type ResponseItem = {
  id: string;
  storeId: string;
  storeName: string;
  rating: number;
  dateLabel: string;
  routeStatus: RouteStatus;
  tags: string[];
  freeText?: string;
};

export const RESPONSES: ResponseItem[] = [
  { id: "r1", storeId: "sannomiya", storeName: "三宮本店", rating: 5, dateLabel: "8/4 12:38", routeStatus: "guided", tags: ["料理・味", "接客・スタッフ"] },
  { id: "r2", storeId: "kobe-motomachi", storeName: "神戸元町店", rating: 4, dateLabel: "8/4 11:52", routeStatus: "guided", tags: ["雰囲気・内装", "コスパ"] },
  {
    id: "r3",
    storeId: "umeda",
    storeName: "梅田うめきた店",
    rating: 2,
    dateLabel: "8/4 11:20",
    routeStatus: "store-only",
    tags: ["提供までの待ち時間"],
    freeText: "注文から提供まで30分ほどかかりました。混雑時の案内があると良いと思います。",
  },
  { id: "r4", storeId: "kyoto-shijo", storeName: "京都四条店", rating: 5, dateLabel: "8/4 10:05", routeStatus: "guided", tags: ["清潔感", "提供スピード"] },
];

export function getStore(storeId: string): StoreSummary {
  return STORES.find((s) => s.id === storeId) ?? STORES[0];
}

export function getStoreResponses(storeId: string): ResponseItem[] {
  return RESPONSES.filter((r) => r.storeId === storeId);
}
