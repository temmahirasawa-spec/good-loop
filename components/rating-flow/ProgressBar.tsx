/** Loop / Progress Bar（Figma node 1:627）— 2ステップのアンケート進行表示 */
export function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex w-full items-start gap-[var(--product-space-4)]" style={{ height: 4 }}>
      <div
        className="h-1 min-w-px flex-1 rounded-[var(--product-radius-full)]"
        style={{ backgroundColor: "var(--loop-accent-primary)" }}
      />
      <div
        className="h-1 min-w-px flex-1 rounded-[var(--product-radius-full)]"
        style={{
          backgroundColor:
            step === 2 ? "var(--loop-accent-primary)" : "var(--product-color-border-default)",
        }}
      />
    </div>
  );
}
