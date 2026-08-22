import type { PopPreset, PopQrSize } from "@/lib/admin/types";

/**
 * 卓上POP（印刷用・A6 105×148mm）の設定（supabase/0012、2026-08-22）。
 *
 * 天真の指示（Figmaコメント）：
 *   「QRはこの3つをプリセットにして、そのプリセットを選んだら内容を自由に編集できるようにしたい。
 *     QRのサイズ、文字の内容などです。」
 *
 * プリセットは3種。店舗が見出し・本文・QRの大きさを書き換えられる。
 * 書き換えていない項目（null）は、ここの既定値をそのまま印刷する。
 */

export const POP_PRESETS: { code: PopPreset; label: string; description: string; heading: string; note: string }[] = [
  {
    code: "a",
    label: "QRが主役",
    description: "コードを大きく。遠くからでも読める",
    heading: "本日はいかがでしたか？",
    note: "1  カメラでコードを読み取る\n2  5段階で選ぶ\n3  よかった点を選んで送信",
  },
  {
    code: "b",
    label: "ことばが主役",
    description: "お店の姿勢が伝わる。声を集めたいとき",
    heading: "気づいたこと、お聞かせください",
    note: "よかったところも、そうでないところも。\nいただいたご意見は店舗が直接受け取ります。",
  },
  {
    code: "c",
    label: "最小限",
    description: "文字を削った形。内装の邪魔をしない",
    heading: "ご意見をお聞かせください",
    note: "",
  },
];

/** QRの大きさ（mm）。A6の幅は105mmなので、大でも余白が残る大きさにしてある */
export const POP_QR_SIZES: { code: PopQrSize; label: string; mm: number }[] = [
  { code: "sm", label: "小", mm: 36 },
  { code: "md", label: "中", mm: 46 },
  { code: "lg", label: "大", mm: 58 },
];

export function presetOf(code: string): (typeof POP_PRESETS)[number] {
  return POP_PRESETS.find((p) => p.code === code) ?? POP_PRESETS[0];
}

export function qrSizeOf(code: string): (typeof POP_QR_SIZES)[number] {
  return POP_QR_SIZES.find((s) => s.code === code) ?? POP_QR_SIZES[2];
}

/** 保存されている値と既定値を合わせて、印刷に使う内容にする */
export function resolvePop(store: { pop_preset: string; pop_heading: string | null; pop_note: string | null; pop_qr_size: string }) {
  const preset = presetOf(store.pop_preset);
  return {
    preset,
    heading: store.pop_heading?.trim() || preset.heading,
    note: store.pop_note ?? preset.note,
    qr: qrSizeOf(store.pop_qr_size),
  };
}
