import type { ReactNode } from "react";

/**
 * AI視認性チェッカーの共通の器。
 *
 * 既存の共通コンポーネントに汎用のCardが無いため、このページ用に作った
 * （docs/specs/design-rules.md 2-3「既存に無い場合は、自作する前に申告する」）。
 * 色・角丸・線はすべて既存トークンを参照し、**影は使わない**
 * （プロトタイプは rgba の影を使っているが、影のトークンが存在しないため）。
 */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--product-radius-lg)] border border-solid ${className ?? ""}`}
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--product-color-border-default)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * セクションの上に置く小さなラテン文字のラベル（Result / Checking など）。
 * 数字と同じく Barlow で組む（Barlow Condensed は読み込んでいないため代用。
 * docs/plans/ai-visibility-checker.md 9-4）。
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[11px] uppercase tracking-[1.76px] ${className ?? ""}`}
      style={{
        fontFamily: "var(--font-barlow), sans-serif",
        fontWeight: 600,
        color: "var(--product-color-text-secondary)",
      }}
    >
      {children}
    </p>
  );
}
