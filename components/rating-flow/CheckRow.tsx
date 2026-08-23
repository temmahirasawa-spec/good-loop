import { CheckboxCheckedIcon, CheckboxUncheckedIcon } from "./icons";

/** Review / Check Row（Figma node 1:557）— ★1-3の改善アンケート用チェック行 */
export function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex h-[52px] w-full items-center gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-solid p-[var(--product-space-16)]"
      style={{
        backgroundColor: checked ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
        borderWidth: checked ? 2 : 1.5,
        borderColor: checked ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
      }}
    >
      {checked ? (
        <CheckboxCheckedIcon className="size-5 shrink-0" style={{ color: "var(--review-accent-primary)" }} />
      ) : (
        <CheckboxUncheckedIcon className="size-5 shrink-0" />
      )}
      <span
        className="whitespace-nowrap text-sm font-bold"
        style={{ color: checked ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}
      >
        {label}
      </span>
    </button>
  );
}
