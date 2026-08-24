"use client";

/**
 * Review / Toggle Switch（Figma node 73:1281）— 設定（通知）の各項目のON/OFF
 *
 * `disabled` は「まだ動かせない機能」を触れなくするために足した（2026-08-24）。
 * 押せる状態にしておくと「設定したのに通知が来ない」になるため。
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 disabled:opacity-40"
      style={{
        backgroundColor: checked ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
        justifyContent: checked ? "flex-end" : "flex-start",
      }}
    >
      <span className="block size-5 rounded-full bg-white" />
    </button>
  );
}
