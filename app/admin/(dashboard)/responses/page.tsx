import { ResponsesView } from "@/components/admin/ResponsesView";
import { getResponseItems } from "@/lib/admin/queries";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/** Dashboard / 回答一覧（Figma node 51:883 PC / 52:899 SP） */
export default async function AdminResponsesPage() {
  const responses = await getResponseItems();
  return <ResponsesView responses={responses} />;
}
