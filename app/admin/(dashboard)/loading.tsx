import { AdminPageSkeleton } from "@/components/admin/Skeleton";

/**
 * 管理画面のページ遷移スケルトン。サイドバー（レイアウト）は残り、
 * 本文だけが骨組みになる。データ取得を待たずに画面が切り替わる。
 */
export default function AdminLoading() {
  return <AdminPageSkeleton />;
}
