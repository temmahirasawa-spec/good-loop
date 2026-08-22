/**
 * 期間の指定（UI検証Q9、2026-08-22）。
 *
 * よく使う期間（プリセット）と、任意の期間（YYYY-MM-DD）のどちらかを取る。
 *
 * この定数はサーバー側（app/admin/(dashboard)/responses/page.tsx）と
 * クライアント側（components/admin/PeriodPicker.tsx）の両方から読むため、
 * `"use client"` を持たないこのファイルに置く。
 * クライアント側のファイルに置くと「サーバーからクライアントの関数を呼んだ」ビルドエラーになる。
 */

export const PERIOD_PRESETS = [
  { code: "7d", label: "直近7日" },
  { code: "14d", label: "直近14日" },
  { code: "month", label: "今月" },
  { code: "90d", label: "直近3ヶ月" },
] as const;

export type PeriodPresetCode = (typeof PERIOD_PRESETS)[number]["code"];
export type PeriodValue = { preset: PeriodPresetCode } | { from: string; to: string };

/** URLに手で書かれた値を弾く（YYYY-MM-DD のみ受け付ける） */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
