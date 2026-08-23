/**
 * ページ遷移中のスケルトン（2026-08-23、天真の指示
 * 「先に移動してスケルトンローディングを出す。タップしてからの反応速度を意識」）。
 *
 * App Router の loading.tsx から使う。データを待たずに骨組みを即描画することで、
 * タップ直後に画面が切り替わる。ふわっと明滅させて「読み込み中」を伝える。
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${className ?? ""}`}
      style={{ backgroundColor: "var(--product-color-border-divider)" }}
      aria-hidden="true"
    />
  );
}

/** トップ・集計・回答一覧など、カードが縦に並ぶ画面の共通スケルトン */
export function AdminPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4 md:gap-6" aria-label="読み込み中">
      <SkeletonBlock className="h-16 w-full md:h-[72px]" />
      <div className="flex w-full flex-col items-start gap-2 md:flex-row md:gap-4">
        <SkeletonBlock className="h-24 w-full md:h-40 md:flex-1" />
        <SkeletonBlock className="h-24 w-full md:h-40 md:flex-1" />
        <SkeletonBlock className="h-24 w-full md:h-40 md:flex-1" />
      </div>
      <SkeletonBlock className="h-56 w-full md:h-72" />
    </div>
  );
}

/** 設定配下の画面（ヘッダーとタブは残るので、カード1枚ぶんだけ） */
export function SettingsPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4" aria-label="読み込み中">
      <SkeletonBlock className="h-72 w-full md:h-96" />
    </div>
  );
}
