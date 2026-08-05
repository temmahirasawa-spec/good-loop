import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * 管理画面のはりぼて（2026-08-05、8/6の洋輔×天真MTGデモ用）。
 *
 * ⚠ Supabase未接続のため、認証・実データ取得はまだ無い。店舗名はFigmaのサンプル
 * （YORKYS BRUNCH）を暫定表示している。ログイン中の運営者が持つ店舗一覧に応じて
 * 出し分ける実装は、Supabase Authが入るセッションで行うこと。
 *
 * ⚠ PC専用（1440幅）。SP版（ドロワー展開含む）はFigmaに存在するが、
 * 時間の都合で今回は実装していない。次のセッションで着手すること。
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full items-start" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <AdminSidebar storeName="YORKYS BRUNCH" />
      <div
        className="flex h-full flex-1 flex-col items-start gap-6 overflow-auto px-8 pb-10 pt-8"
        style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
      >
        {children}
      </div>
    </div>
  );
}
