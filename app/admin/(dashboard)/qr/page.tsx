import { QrPageView } from "@/components/admin/QrPageView";
import { getStoreSummaries } from "@/lib/admin/queries";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/** Dashboard / 二次元コード発行（Figma node 56:931 PC / 56:1292 SP） */
export default async function AdminQrPage() {
  const stores = await getStoreSummaries();
  return <QrPageView stores={stores} />;
}
