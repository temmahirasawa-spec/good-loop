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
  reviewIncrease: number;
  reviewIncreasePrev: number;
  routeRatePercent: number | null;
  routeRateDeltaPt: number | null;
  responseCount: number;
  responseCountPrev: number;
  avgRating: number;
  trend: number[];
};

export const STORES: StoreSummary[] = [
  { id: "sannomiya", name: "三宮本店", reviewIncrease: 21, reviewIncreasePrev: 18, routeRatePercent: 61, routeRateDeltaPt: 2, responseCount: 62, responseCountPrev: 58, avgRating: 4.4, trend: [16, 18, 15, 17, 21] },
  { id: "umeda", name: "梅田うめきた店", reviewIncrease: 7, reviewIncreasePrev: 9, routeRatePercent: 29, routeRateDeltaPt: -32, responseCount: 41, responseCountPrev: 44, avgRating: 3.8, trend: [16, 18, 15, 17, 7] },
  { id: "kobe-motomachi", name: "神戸元町店", reviewIncrease: 19, reviewIncreasePrev: 16, routeRatePercent: 62, routeRateDeltaPt: 3, responseCount: 55, responseCountPrev: 51, avgRating: 4.2, trend: [12, 15, 14, 18, 19] },
  { id: "osaka-honmachi", name: "大阪本町店", reviewIncrease: 1, reviewIncreasePrev: 2, routeRatePercent: null, routeRateDeltaPt: null, responseCount: 3, responseCountPrev: 39, avgRating: 4.1, trend: [8, 9, 6, 4, 1] },
  { id: "kyoto-shijo", name: "京都四条店", reviewIncrease: 9, reviewIncreasePrev: 8, routeRatePercent: 61, routeRateDeltaPt: 3, responseCount: 28, responseCountPrev: 26, avgRating: 4.0, trend: [7, 8, 6, 8, 9] },
];

export const TREND_WEEK_LABELS = ["5週前", "4週前", "3週前", "2週前", "今週"];

export const ALL_STORES_TREND = [61, 64, 59, 63, 57];

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
