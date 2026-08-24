/**
 * Review / Rating Button（Figma node 1:427）
 * GOOD REVIEW 評価トップの5段階ボタン。Level=5/4 は大サイズ、3以下は小サイズ。
 * 初期状態は全て Default（ニュートラル）で、タップ時のみ Selected に切り替える。
 */

const LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "不満",
  2: "やや不満",
  3: "ふつう",
  4: "満足",
  5: "とても満足",
};

export function RatingButton({
  level,
  selected,
  onSelect,
}: {
  level: 1 | 2 | 3 | 4 | 5;
  selected: boolean;
  onSelect: () => void;
}) {
  const large = level === 5 || level === 4;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-1 flex-col items-center rounded-[var(--product-radius-md)] border-solid px-[var(--product-space-8)]"
      style={{
        backgroundColor: selected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
        gap: large ? "var(--product-space-8)" : "var(--product-space-4)",
        paddingTop: large ? "var(--product-space-20)" : "var(--product-space-16)",
        paddingBottom: large ? "var(--product-space-20)" : "var(--product-space-16)",
      }}
    >
      <span
        className="flex items-start gap-[var(--product-space-2)]"
        style={{ fontSize: large ? 15 : 10, fontWeight: 700 }}
      >
        <span style={{ color: "var(--product-color-status-warning)" }}>{"★".repeat(level)}</span>
        {level < 5 && <span style={{ color: "var(--product-color-text-muted)" }}>{"★".repeat(5 - level)}</span>}
      </span>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: large ? 14 : 12,
          fontWeight: large ? 700 : 500,
          color: selected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)",
        }}
      >
        {LABELS[level]}
      </span>
    </button>
  );
}
