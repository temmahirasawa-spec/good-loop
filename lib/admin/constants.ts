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
  { slug: "salon", label: "ブラウン", swatchPrimary: "#a98a5c", swatchLight: "#f1e4cf" }, // design-qa-allow: 非アクティブ色のプレビュー（light は 2026-09-28 に #f8f2e8 から変更）
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
 * 料金（設定・お支払い／店舗枠の追加）。**金額はすべて税込（内税）。**
 *
 * 2026-10-03、税込表示に切り替えた（天真の決定）：月 9,800円（税込・1店舗込み）、追加店舗 1店舗 月 4,800円（税込）。
 * 小さな店（免税事業者）には税込の額がそのまま負担になるため。Stripe の税率も内税（inclusive）にする（docs/specs/billing.md §2）。
 *
 * 2026-08-27 に確定した（洋輔 × 天真）：スタンダード月 9,800円（1店舗込み）、追加店舗 1店舗 月 5,000円（当時は税抜。2026-10-03 に上の税込へ改めた）。
 * 仮の値だった追加店舗 3,000円は誤り（2026-09-28 まで画面に残っていて、Stripe の請求 5,000円と食い違っていた）。
 * 画面に出る金額はすべてここを参照しているので、**このオブジェクトだけを書き換えれば
 * 全画面の表示が変わる**（他の場所に金額を直書きしないこと）。
 *
 * **実際の請求額の正は Stripe の価格（Price）。** 金額を変えるときは docs/specs/billing.md の
 * 「金額を変えるときに直す場所」のとおり、Stripe の価格・環境変数の価格ID・ここ・LP・Figma を一緒に直す。
 */
export const BILLING = {
  planLabel: "スタンダード",
  planMonthlyYen: 9800,
  /** 基本プランに含まれる店舗数。これを超える店舗は追加課金 */
  includedStores: 1,
  /** 追加1店舗あたりの月額 */
  additionalStoreMonthlyYen: 4800,
  /**
   * 消費税の率。金額は税込なので、画面に「うち消費税」を出すための見積もりに使う（docs/specs/billing.md §2）。
   * 実際の請求の税は Stripe の税率（STRIPE_TAX_RATE_ID・内税）で計算される。ここを変えても請求は変わらない
   */
  taxRatePercent: 10,
};

/** 月額の見積もり。total は税込のお支払い額、tax はそのうちの消費税（円） */
export type MonthlyQuote = { total: number; tax: number };

/**
 * 明細の合計と税率から、税込の支払い額と消費税を出す。
 * 内税（inclusive）なら合計がそのまま支払い額、外税なら税を足す。Stripe は明細ごとに端数を丸めるので、表示用の見積もり。
 */
export function quoteFromAmount(amount: number, taxPercent: number, inclusive: boolean): MonthlyQuote {
  if (inclusive) return { total: amount, tax: amount - Math.round(amount / (1 + taxPercent / 100)) };
  const total = Math.round(amount * (1 + taxPercent / 100));
  return { total, tax: total - amount };
}

/** 店舗枠から月額（税込）を見積もる。追加店舗は「店舗枠 − 基本に含まれる店舗数」 */
export function monthlyQuoteFor(quota: number): MonthlyQuote & { extraStores: number } {
  const extraStores = Math.max(0, quota - BILLING.includedStores);
  const amount = BILLING.planMonthlyYen + extraStores * BILLING.additionalStoreMonthlyYen;
  return { ...quoteFromAmount(amount, BILLING.taxRatePercent, true), extraStores };
}

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

/**
 * 「項目ごとに集計される」の注記（オンボーディング ステップ4・集計画面で共通）。
 *
 * 2026-08-24、天真の指摘で書き直した。旧文言「項目を変えるとその前後の数字は
 * 分けて数えられます」は何が起きるのか伝わらない。**具体例で言い換えた。**
 * 文言を変えるときは Figma（オンボーディング4・集計画面）も同じ文に揃えること。
 */
export const SURVEY_TALLY_NOTE =
  "回答は、この項目ごとに集計されます。項目はあとから変えられますが、名前を変えると別の項目として0から数え直しになります。たとえば「接客」を「接客・スタッフ」に変えた場合、それまでの「接客」の集計は消えずに集計画面へ残ります。";
