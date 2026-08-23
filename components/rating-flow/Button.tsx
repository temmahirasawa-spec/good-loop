import type { ReactNode } from "react";
import { CopyIcon, PinIcon, RefreshIcon } from "./icons";

/**
 * Review / Button（Figma node 1:568）
 *
 * Copy は点線ボーダーで「コピー専用」を明示し、画面遷移ボタン（Google）と視覚的に区別する。
 * Google の Disabled はコピー完了前の待機状態。Regenerate は下書きの再生成用の小ボタン。
 *
 * 2026-08-22、天真の指示（docs/ui-review.md Q4）でボタンの体系を整理した。
 *
 *   primary … その画面で**最も重要な決定が1つだけ**。ベタ塗り（保存する・回答する・申し込む）
 *   outline … それ以外の一般的な操作。白地＋アクセント色の枠（ダウンロード・一覧を見る）
 *   danger  … 取り消せない操作。白地＋赤の枠（退会する）
 *   ※ キャンセル等の「やめる」操作はボタンにせず、テキストのままにする
 *
 * あわせて角丸を 16 → **8**（`--product-radius-sm`）にし、高さを
 * **SP 52px / PC 44px** にした（「PCでは大きすぎる」という指摘による）。
 * 来店客側の画面は390px固定の設計なので、`size="lg"` を渡して52pxのままにする。
 */

type ButtonStyle = "primary" | "outline" | "danger";
type Size = "md" | "lg";

type StyledProps = { variant: ButtonStyle; disabled?: boolean; size?: Size; children: ReactNode; onClick?: () => void; type?: "button" | "submit" };
type CopyProps = { variant: "copy"; copied?: boolean; onClick?: () => void };
type GoogleProps = { variant: "google"; disabled?: boolean; onClick?: () => void };
type RegenerateProps = { variant: "regenerate"; disabled?: boolean; onClick?: () => void };

type Props = StyledProps | CopyProps | GoogleProps | RegenerateProps;

/** SPは52px、PCは44px。来店客側（390px固定）は lg で52pxのまま */
const HEIGHT: Record<Size, string> = {
  md: "h-[52px] min-h-11 md:h-11",
  lg: "h-[52px] min-h-[52px]",
};

function styleOf(variant: ButtonStyle, disabled: boolean) {
  if (disabled) {
    return variant === "primary"
      ? { backgroundColor: "var(--product-color-bg-tertiary)", color: "var(--product-color-text-disabled)" }
      : {
          backgroundColor: "var(--product-color-surface-white)",
          color: "var(--product-color-text-disabled)",
          borderWidth: 1.2,
          borderColor: "var(--product-color-border-default)",
        };
  }
  if (variant === "primary") {
    return { backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" };
  }
  if (variant === "danger") {
    return {
      backgroundColor: "var(--product-color-surface-white)",
      color: "var(--product-color-status-error)",
      borderWidth: 1.2,
      borderColor: "var(--product-color-status-error)",
    };
  }
  // outline
  return {
    backgroundColor: "var(--product-color-surface-white)",
    color: "var(--product-color-text-secondary)",
    borderWidth: 1.2,
    borderColor: "var(--review-accent-primary)",
  };
}

export function ReviewButton(props: Props) {
  if (props.variant === "regenerate") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        className="flex h-11 min-h-9 shrink-0 items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-full)] border-[1.2px] border-solid px-[var(--product-space-12)] py-[var(--product-space-4)]"
        style={{
          backgroundColor: "var(--product-color-surface-white)",
          borderColor: "var(--product-color-border-default)",
          color: props.disabled ? "var(--product-color-text-disabled)" : "var(--product-color-text-secondary)",
        }}
      >
        <RefreshIcon disabled={props.disabled} className="size-[13px] shrink-0" />
        <span className="whitespace-nowrap text-[11px] font-bold tracking-[0.22px]">再生成</span>
      </button>
    );
  }

  if (props.variant === "copy") {
    const copied = props.copied ?? false;
    return (
      <button
        type="button"
        onClick={props.onClick}
        className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-sm)] border-solid p-[var(--product-space-16)]"
        style={{
          backgroundColor: copied ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
          borderWidth: copied ? 1.2 : 2,
          borderStyle: copied ? "solid" : "dashed",
          borderColor: "var(--review-accent-primary)",
          color: "var(--review-accent-primary)",
        }}
      >
        <CopyIcon className="size-[17px] shrink-0" />
        <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.15px]">
          {copied ? "コピーしました" : "この文章をコピー"}
        </span>
      </button>
    );
  }

  if (props.variant === "google") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-sm)] border-[1.2px] border-solid p-[var(--product-space-16)]"
        style={{
          backgroundColor: props.disabled ? "var(--product-color-bg-tertiary)" : "var(--product-color-surface-white)",
          borderColor: "var(--product-color-border-default)",
          color: props.disabled ? "var(--product-color-text-disabled)" : "var(--product-color-text-primary)",
        }}
      >
        <PinIcon disabled={props.disabled} className="size-[17px] shrink-0" />
        <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.15px]">Googleマップを開く</span>
      </button>
    );
  }

  const disabled = props.disabled ?? false;
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={disabled}
      className={`flex ${HEIGHT[props.size ?? "md"]} w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-sm)] border-solid px-[var(--product-space-16)]`}
      style={styleOf(props.variant, disabled)}
    >
      <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.15px]">{props.children}</span>
    </button>
  );
}
