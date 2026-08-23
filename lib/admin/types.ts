/** 管理画面が扱うデータの型。値の出どころは lib/admin/queries.ts（Supabaseの実データ） */

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  loopTheme: string;
  /** 業態。2026-08-06、loopTheme（色）から分離した（supabase/0007参照） */
  businessCategory: string;
  /** Googleのクチコミ投稿画面へ送り出した数。実際に投稿されたかはGOOD REVIEWからは分からない */
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

/**
 * 色テーマ（設定・ブランドとテーマ）。2026-08-06、業態から分離した。
 * slug は Industry Theme の9モードのスラッグ（値は変えていない）。label は業態名ではなく色名。
 */
export type ReviewTheme = {
  slug: string;
  label: string;
  /** app/design-tokens.css の accent/primary・accent/wash と同値（Figmaのスウォッチ実測） */
  swatchPrimary: string;
  swatchLight: string;
};

/** 業態（設定・店舗管理／店舗追加）。2026-08-06新設。色テーマとは独立に選ぶ */
export type BusinessCategory = {
  slug: string;
  label: string;
};

/** 卓上POP（印刷用）の設定（supabase/0012、2026-08-22） */
export type PopPreset = "a" | "b" | "c";
export type PopQrSize = "sm" | "md" | "lg";
