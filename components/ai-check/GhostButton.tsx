import type { ReactNode } from "react";

/**
 * 白地・枠線だけの副ボタン。
 *
 * 既存の `LoopButton`（components/rating-flow/Button.tsx）は variant が
 * primary / copy / google / regenerate の4つで、いずれも文言や用途が固定されている。
 * 汎用の副ボタンが無いためここで作った
 * （docs/specs/design-rules.md 2-3「既存に無い場合は、自作する前に申告する」）。
 *
 * `LoopButton` に variant を足すことも考えたが、あれは Figma のノード 1:568 に
 * 紐づいた共通部品で、来店客の画面でも使っている。Figma に無い variant を
 * 足すのはデザインの判断にあたるため、このページ内に閉じた実装にした。
 */
export function GhostButton({
  children,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-lg)] border-[1.2px] border-solid p-[var(--product-space-16)]"
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--product-color-border-default)",
        color: "var(--product-color-text-primary)",
      }}
    >
      <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.15px]">{children}</span>
    </button>
  );
}
