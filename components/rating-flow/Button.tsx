import type { ReactNode } from "react";
import { CopyIcon, PinIcon, RefreshIcon } from "./icons";

/**
 * Loop / Button（Figma node 1:568）
 * Copy は点線ボーダーで「コピー専用」を明示し、画面遷移ボタン（Google）と視覚的に区別する。
 * Google の Disabled はコピー完了前の待機状態。Regenerate は下書きの再生成用の小ボタン。
 */

type PrimaryProps = { variant: "primary"; disabled?: boolean; children: ReactNode; onClick?: () => void };
type CopyProps = { variant: "copy"; copied?: boolean; onClick?: () => void };
type GoogleProps = { variant: "google"; disabled?: boolean; onClick?: () => void };
type RegenerateProps = { variant: "regenerate"; disabled?: boolean; onClick?: () => void };

type Props = PrimaryProps | CopyProps | GoogleProps | RegenerateProps;

export function LoopButton(props: Props) {
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
        className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-lg)] border-solid p-[var(--product-space-16)]"
        style={{
          backgroundColor: copied ? "var(--loop-accent-wash)" : "var(--product-color-surface-white)",
          borderWidth: copied ? 1.2 : 2,
          borderStyle: copied ? "solid" : "dashed",
          borderColor: "var(--loop-accent-primary)",
          color: "var(--loop-accent-action)",
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
        className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-lg)] border-[1.2px] border-solid p-[var(--product-space-16)]"
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

  // primary
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex h-[52px] min-h-[52px] w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-lg)] p-[var(--product-space-16)]"
      style={{
        backgroundColor: props.disabled ? "var(--product-color-bg-tertiary)" : "var(--loop-accent-primary)",
        color: props.disabled ? "var(--product-color-text-disabled)" : "var(--loop-accent-on-primary)",
      }}
    >
      <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.15px]">{props.children}</span>
    </button>
  );
}
