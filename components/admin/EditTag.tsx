"use client";

/** Review / Edit Tag（Figma node 73:1288）— 設定（アンケート項目）の編集可能なタグ */
export function EditTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-full px-4 py-3" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}>
      <span className="whitespace-nowrap text-sm text-[color:var(--product-color-text-primary)]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label}を削除`}
        className="text-[13px]"
        style={{ color: "var(--product-color-text-tertiary)" }}
      >
        ×
      </button>
    </div>
  );
}

/** Add Tag（Figma node 74:1405）— タグ追加の点線ボタン */
export function AddTagButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-dashed px-4 py-3 text-sm"
      style={{ borderColor: "var(--product-color-border-default)", color: "var(--product-color-text-secondary)" }}
    >
      ＋ 追加
    </button>
  );
}
