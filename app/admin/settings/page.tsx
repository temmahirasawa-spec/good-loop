/**
 * 設定画面はFigmaにまだデザインが無い（07 管理画面セクションにフレームなし）。
 * サイドナビの導線だけ用意し、中身は「準備中」の仮置きにしてある。
 */
export default function AdminSettingsPage() {
  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-2xl p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        準備中
      </p>
      <p className="text-sm" style={{ color: "var(--product-color-text-secondary)" }}>
        設定画面はまだFigmaにデザインがありません
      </p>
    </div>
  );
}
