import type { ReactNode } from "react";

/**
 * 状態を表す小さなピル。
 *
 * ⚠ 「登場した／登場せず」を緑と赤で塗り分けたいところだが、
 *    既存トークンに成功色（緑）も危険色（赤）も無い。
 *    そのため **登場した＝アクセント色 / 登場せず＝グレー** の2値で表す
 *    （docs/plans/ai-visibility-checker.md 9-2、2026-08-17 天真了承）。
 */
export type PillTone = "accent" | "muted";

export function Pill({ tone = "muted", children }: { tone?: PillTone; children: ReactNode }) {
  const style =
    tone === "accent"
      ? {
          backgroundColor: "var(--loop-accent-wash)",
          borderColor: "var(--loop-accent-light)",
          color: "var(--loop-accent-primary)",
        }
      : {
          backgroundColor: "var(--product-color-bg-secondary)",
          borderColor: "var(--product-color-border-default)",
          color: "var(--product-color-text-secondary)",
        };

  return (
    <span
      className="inline-flex shrink-0 items-center gap-[var(--product-space-4)] whitespace-nowrap rounded-[var(--product-radius-full)] border border-solid px-[var(--product-space-8)] py-[var(--product-space-2)] text-xs font-bold"
      style={style}
    >
      {children}
    </span>
  );
}

/** エンジン名（Claude など）を出す小さなチップ */
export function EngineChip({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--product-radius-md)] border border-solid px-[var(--product-space-8)] py-[var(--product-space-2)] text-[10.5px] tracking-[0.6px]"
      style={{
        fontFamily: "var(--font-barlow), sans-serif",
        fontWeight: 600,
        backgroundColor: "var(--product-color-bg-secondary)",
        borderColor: "var(--product-color-border-default)",
        color: "var(--product-color-text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
