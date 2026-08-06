import type { LoopTheme } from "./types";

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
