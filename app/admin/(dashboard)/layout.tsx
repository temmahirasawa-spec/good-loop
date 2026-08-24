import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { CoachMarksAutoStart } from "@/components/admin/CoachMarks";
import { StoreNameProvider } from "@/components/admin/StoreNameContext";
import { getCurrentStore } from "@/lib/admin/current-store";

/**
 * 管理画面の共通レイアウト。
 *
 * SP対応（2026-08-05）：PCはサイドバー常設、SPはハンバーガー+ドロワー
 * （`components/admin/AdminMobileNav.tsx`）。各ページの先頭で
 * `<AdminMobileTopBar>` を呼び出している。
 *
 * `(dashboard)` ルートグループにした理由（2026-08-05・未実装10画面の実装時）：
 * `/admin/login`（サイドバーを持たない単独ページ）を `/admin` 配下に置きつつ、
 * このレイアウトの対象から外すため。URLパスにはグループ名が出ない。
 *
 * 店舗名はログイン中テナントの店舗から取得する（2026-08-06、フェーズ5でSupabase Auth接続）。
 * middleware.ts が未ログイン時にここへ到達させないため、通常は必ず店舗が存在する。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await getCurrentStore();

  // 店舗が1つも無い＝新規登録の直後（signup は店舗を作らない。オンボーディングの
  // ステップ2で聞くため）。管理画面は店舗前提で組まれているので、先に作ってもらう
  if (!store) redirect("/admin/onboarding");

  const storeName = store.name;

  return (
    <StoreNameProvider value={storeName}>
      <div className="flex h-dvh w-full items-start" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
        {/* コーチマーク（PC）。初回だけサイドバーの4項目を順に説明する。SPはドロワー側 */}
        <CoachMarksAutoStart />
        <AdminSidebar storeName={storeName} />
        <div
          className="flex h-full flex-1 flex-col items-start gap-4 overflow-auto px-4 pb-8 pt-6 md:gap-6 md:px-8 md:pb-10 md:pt-8"
          style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
        >
          {children}
        </div>
      </div>
    </StoreNameProvider>
  );
}
