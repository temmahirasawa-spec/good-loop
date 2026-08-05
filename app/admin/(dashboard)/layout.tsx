import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * 管理画面のはりぼて（2026-08-05、8/6の洋輔×天真MTGデモ用）。
 *
 * ⚠ Supabase未接続のため、認証・実データ取得はまだ無い。店舗名はFigmaのサンプル
 * （YORKYS BRUNCH）を暫定表示している。ログイン中の運営者が持つ店舗一覧に応じて
 * 出し分ける実装は、Supabase Authが入るセッションで行うこと。
 *
 * SP対応（2026-08-05）：PCはサイドバー常設、SPはハンバーガー+ドロワー
 * （`components/admin/AdminMobileNav.tsx`）。各ページの先頭で
 * `<AdminMobileTopBar>` を呼び出している。
 *
 * `(dashboard)` ルートグループにした理由（2026-08-05・未実装10画面の実装時）：
 * `/admin/login`（サイドバーを持たない単独ページ）を `/admin` 配下に置きつつ、
 * このレイアウトの対象から外すため。URLパスにはグループ名が出ない。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full items-start" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <AdminSidebar storeName="YORKYS BRUNCH" />
      <div
        className="flex h-full flex-1 flex-col items-start gap-4 overflow-auto px-4 pb-8 pt-6 md:gap-6 md:px-8 md:pb-10 md:pt-8"
        style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
      >
        {children}
      </div>
    </div>
  );
}
