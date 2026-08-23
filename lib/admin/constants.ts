import type { ReviewTheme, BusinessCategory } from "./types";

/**
 * 色テーマ一覧（設定・ブランドとテーマ）。順序・値は Industry Theme の9モードと一致させる。
 *
 * 2026-08-06、天真の決定により業態から分離した。スラッグ・実際の色（swatchPrimary/Light）は
 * 従来のまま変えていない（既存店舗のデータ・Figmaのモード名との対応を保つため）。
 * 変わったのは label だけ：業態名ではなく色名で表示する（飲食店がオレンジ以外を選べるように）。
 *
 * このカードは9色すべてを同時に並べて見せる一覧であり、`--review-accent-primary` 等は
 * アクティブな1色の値しか持たない（app/design-tokens.css）。選択中でない8色ぶんは、
 * その色自身を出す必要があるため変数にバインドできない。値は Figma のスウォッチを
 * 実測したもので、app/design-tokens.css の該当モードと同値（design-qa-allow はこの理由で各行に付けてある）。
 */
export const INDUSTRY_THEMES: ReviewTheme[] = [
  { slug: "clinic", label: "グリーン", swatchPrimary: "#00c471", swatchLight: "#dff9ec" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "restaurant", label: "オレンジ", swatchPrimary: "#e0552b", swatchLight: "#fceee7" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "salon", label: "ブラウン", swatchPrimary: "#a98a5c", swatchLight: "#f8f2e8" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "beauty", label: "ピンク", swatchPrimary: "#db6e8c", swatchLight: "#fcedf1" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "seikotsuin", label: "ネイビー", swatchPrimary: "#2c6fb5", swatchLight: "#e8f1fa" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "fitness", label: "ライム", swatchPrimary: "#93c90f", swatchLight: "#f2fbdd" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "school", label: "アンバー", swatchPrimary: "#efa71e", swatchLight: "#fef4e0" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "pet", label: "スカイ", swatchPrimary: "#1fa5d6", swatchLight: "#e4f5fc" }, // design-qa-allow: 非アクティブ色のプレビュー
  { slug: "lodging-sauna", label: "フォレスト", swatchPrimary: "#2f6b54", swatchLight: "#e8f1ed" }, // design-qa-allow: 非アクティブ色のプレビュー
];

/**
 * 業態一覧（設定・店舗管理／店舗追加）。2026-08-06新設、色テーマから分離した。
 * スラッグは INDUSTRY_THEMES と同じ9種を再利用している（historically業態名から取ったスラッグの
 * ため）が、概念としては独立している。色のスウォッチは持たない。
 */
export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { slug: "clinic", label: "クリニック" },
  { slug: "restaurant", label: "飲食店" },
  { slug: "salon", label: "美容室" },
  { slug: "beauty", label: "エステ・美容" },
  { slug: "seikotsuin", label: "整骨院" },
  { slug: "fitness", label: "フィットネス" },
  { slug: "school", label: "スクール" },
  { slug: "pet", label: "ペット" },
  { slug: "lodging-sauna", label: "宿泊・サウナ" },
];

export const TREND_WEEK_LABELS = ["5週前", "4週前", "3週前", "2週前", "今週"];

/**
 * 料金（設定・お支払い／店舗枠の追加）。
 *
 * ⚠ 2026-08-21時点で**金額は未確定の仮の値**（launch-plan.md 6章の未決事項1）。
 * 天真の決定により「仮の金額で作り、決まったらここだけ直す」形にしている。
 * 画面に出る金額はすべてここを参照しているので、**このオブジェクトだけを書き換えれば
 * 全画面の表示が変わる**（他の場所に金額を直書きしないこと）。
 *
 * Stripe をつないだら、金額の正はStripeの価格（Price）側に移す。
 */
export const BILLING = {
  planLabel: "スタンダード",
  planMonthlyYen: 9800,
  /** 基本プランに含まれる店舗数。これを超える店舗は追加課金 */
  includedStores: 1,
  /** 追加1店舗あたりの月額 */
  additionalStoreMonthlyYen: 3000,
};

/** 金額の表示形式を1箇所に揃える（例: 9800 → 「9,800円」） */
export function formatYen(yen: number): string {
  return `${yen.toLocaleString("ja-JP")}円`;
}

/**
 * 「二次元コードの読み取りが少なくなっている」と見なす直近7日の読み取り回数。
 *
 * 2026-08-23、この警告を設定＞店舗管理からトップへ移した（Figmaコメント 1895821315
 * 「ここは集計や分析画面ではないので、この読み取り低下機能はトップページに移動する」）。
 */
export const LOW_READS_THRESHOLD = 20;
