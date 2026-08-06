/** 管理画面が扱うデータの型。値の出どころは lib/admin/queries.ts（Supabaseの実データ） */

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  loopTheme: string;
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
  /** 二次元コードの読み取り数（今週） */
  qrReads: number;
  qrReadsPrev: number;
};

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

export type LoopTheme = {
  slug: string;
  label: string;
  /** app/design-tokens.css の accent/primary・accent/wash と同値（Figmaのスウォッチ実測） */
  swatchPrimary: string;
  swatchLight: string;
};
