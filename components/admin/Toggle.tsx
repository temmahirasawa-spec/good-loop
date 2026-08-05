"use client";

/** Loop / Toggle Switch（Figma node 73:1281）— 設定（通知）の各項目のON/OFF */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5"
      style={{
        backgroundColor: checked ? "var(--loop-accent-primary)" : "var(--product-color-border-default)",
        justifyContent: checked ? "flex-end" : "flex-start",
      }}
    >
      <span className="block size-5 rounded-full bg-white" />
    </button>
  );
}
