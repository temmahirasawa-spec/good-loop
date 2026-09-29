import { INDUSTRY_THEMES } from "@/lib/admin/constants";

/**
 * 卓上POP（名刺サイズ 91×55mm）の設定（supabase/0012・0018）。
 *
 * 2026-09-29、天真「A6だと大きいと思うので名刺サイズがいい」で作り直した。
 * Figma：テンプレートは Components「08 卓上POP / 名刺サイズ」（1566:25902。1mm＝4px）、
 * 画面は App Design Master「13 卓上POP / 名刺サイズ（案3 ステップ）」。
 *
 * - 向きは横・縦。デザインは向きごとに6種（シンプル2・イラスト2・ベタ塗り2）
 * - 色は色テーマ（Industry Theme）の9色。未設定なら店舗の色テーマ（loop_theme）
 * - 見出し・ひとこと・QRの大きさは A6 のときの保存値をそのまま引き継ぐ（空なら既定の文言）
 * - 印刷は A4 の名刺用紙（10面）にまとめて（components/admin/pop/PopPrintSheet.tsx）
 */

export type PopOrientation = "landscape" | "portrait";
export type PopDesign = "simple" | "simple_frame" | "illust_bubble" | "illust_phone" | "solid" | "solid_band";
export type PopQrSize = "sm" | "md" | "lg";

export const POP_ORIENTATIONS: { code: PopOrientation; label: string }[] = [
  { code: "landscape", label: "横（91×55mm）" },
  { code: "portrait", label: "縦（55×91mm）" },
];

/** 並びは Figma の候補の並び（2列×3行）のとおり */
export const POP_DESIGNS: { code: PopDesign; label: string }[] = [
  { code: "simple", label: "シンプル" },
  { code: "simple_frame", label: "シンプル・枠" },
  { code: "illust_bubble", label: "イラスト・吹き出し" },
  { code: "illust_phone", label: "イラスト・スマホ" },
  { code: "solid", label: "ベタ塗り" },
  { code: "solid_band", label: "ベタ塗り・帯" },
];

/** QRの大きさ。デザインごとの基準の大きさ（＝大）に掛ける倍率 */
export const POP_QR_SIZES: { code: PopQrSize; label: string; scale: number }[] = [
  { code: "sm", label: "小", scale: 0.75 },
  { code: "md", label: "中", scale: 0.875 },
  { code: "lg", label: "大", scale: 1 },
];

/** 色は色テーマの9色（スラッグ＝ data-review-theme の値） */
export const POP_COLORS = INDUSTRY_THEMES;

/** 何も書かなかったときに印刷する文言（Figma のテンプレートの文言） */
export const POP_DEFAULT_HEADING = "本日はいかがでしたか？";
export const POP_DEFAULT_NOTE = "30秒で終わります";

export const POP_MAX_HEADING = 20;
export const POP_MAX_NOTE = 30;

const ORIENTATION_SET = new Set<string>(POP_ORIENTATIONS.map((o) => o.code));
const DESIGN_SET = new Set<string>(POP_DESIGNS.map((d) => d.code));
const COLOR_SET = new Set<string>(POP_COLORS.map((c) => c.slug));
const QR_SET = new Set<string>(POP_QR_SIZES.map((s) => s.code));

export const isPopOrientation = (v: unknown): v is PopOrientation => typeof v === "string" && ORIENTATION_SET.has(v);
export const isPopDesign = (v: unknown): v is PopDesign => typeof v === "string" && DESIGN_SET.has(v);
export const isPopColor = (v: unknown): v is string => typeof v === "string" && COLOR_SET.has(v);
export const isPopQrSize = (v: unknown): v is PopQrSize => typeof v === "string" && QR_SET.has(v);

export function qrScaleOf(code: string): number {
  return POP_QR_SIZES.find((s) => s.code === code)?.scale ?? 1;
}

/** 保存している設定（stores の列）。画面と印刷の両方で使う */
export type PopSettings = {
  orientation: PopOrientation;
  design: PopDesign;
  color: string;
  heading: string;
  note: string;
  qrSize: PopQrSize;
  showStoreLogo: boolean;
  showBrandLogo: boolean;
};

export const POP_COLUMNS =
  "pop_orientation, pop_design, pop_color, pop_heading, pop_note, pop_qr_size, pop_show_store_logo, pop_show_brand_logo";

export type PopRow = {
  pop_orientation: string | null;
  pop_design: string | null;
  pop_color: string | null;
  pop_heading: string | null;
  pop_note: string | null;
  pop_qr_size: string | null;
  pop_show_store_logo: boolean | null;
  pop_show_brand_logo: boolean | null;
};

/**
 * 保存されている値を、画面で扱う形にする。見出し・ひとことは**保存した文字のまま**（空なら空）。
 * 印刷で既定の文言に置き換えるのは printableText で行う。
 */
export function popSettingsFromRow(row: PopRow, storeTheme: string): PopSettings {
  return {
    orientation: isPopOrientation(row.pop_orientation) ? row.pop_orientation : "landscape",
    design: isPopDesign(row.pop_design) ? row.pop_design : "simple",
    color: isPopColor(row.pop_color) ? row.pop_color : isPopColor(storeTheme) ? storeTheme : "clinic",
    heading: row.pop_heading ?? "",
    note: row.pop_note ?? "",
    qrSize: isPopQrSize(row.pop_qr_size) ? row.pop_qr_size : "lg",
    showStoreLogo: row.pop_show_store_logo ?? true,
    showBrandLogo: row.pop_show_brand_logo ?? true,
  };
}

/**
 * 印刷する文言。空のときは既定の文言。A6 のころの長い本文（改行つき）は名刺に入らないので、1行目だけを使う。
 */
export function printableText(settings: Pick<PopSettings, "heading" | "note">) {
  const firstLine = (s: string) => s.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "";
  return {
    heading: firstLine(settings.heading) || POP_DEFAULT_HEADING,
    note: firstLine(settings.note) || POP_DEFAULT_NOTE,
  };
}
