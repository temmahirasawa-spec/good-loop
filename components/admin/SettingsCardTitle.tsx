/**
 * 設定カードの見出し（アイコン＋タイトル）。
 *
 * 2026-08-22、天真のFigmaコメント「メニュー一覧で作成したアイコンがはじめにくるべき」による。
 * スマホのメニュー画面で見たアイコンが、個別ページの見出しにも同じ形で出ることで、
 * 「いまどのページにいるか」が一目で分かるようにする。
 */
export function SettingsCardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2">
      {icon}
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {children}
      </p>
    </div>
  );
}
