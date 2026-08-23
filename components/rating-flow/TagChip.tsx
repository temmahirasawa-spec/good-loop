/** Review / Tag Chip（Figma node 1:551）— 良かった点タグの選択チップ。最小タップ領域44pxを担保 */
export function TagChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="flex h-12 flex-1 items-center justify-center rounded-[var(--product-radius-md)] border-solid p-[var(--product-space-12)]"
      style={{
        minHeight: "var(--product-touch-min)",
        backgroundColor: selected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
      }}
    >
      <span
        className="whitespace-nowrap text-base font-bold"
        style={{ color: selected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}
      >
        {label}
      </span>
    </button>
  );
}
