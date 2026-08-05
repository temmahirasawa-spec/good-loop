/** Loop / Step Number（Figma node 1:608）— コピー画面の①②③。対応するボタンがアクティブなときだけ Active */
export function StepNumber({ number, active }: { number: 1 | 2 | 3; active: boolean }) {
  return (
    <div
      className="flex size-[22px] shrink-0 items-center justify-center rounded-[var(--product-radius-full)]"
      style={{ backgroundColor: active ? "var(--loop-accent-primary)" : "var(--product-color-bg-tertiary)" }}
    >
      <span
        className="text-xs"
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontWeight: 600,
          color: active ? "var(--loop-accent-on-primary)" : "var(--product-color-text-tertiary)",
        }}
      >
        {number}
      </span>
    </div>
  );
}
