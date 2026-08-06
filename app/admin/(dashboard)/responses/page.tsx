import { ResponsesView } from "@/components/admin/ResponsesView";
import { getResponseItems, getStoreSummaries } from "@/lib/admin/queries";
import type { PeriodCode } from "@/components/admin/PeriodSegment";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

const PERIOD_CODES: PeriodCode[] = ["7d", "14d", "month", "90d"];
const BRANCHES = ["good", "improve"] as const;

/**
 * Dashboard / 回答一覧（Figma node 51:883 PC / 52:899 SP）。
 *
 * フィルター（店舗・評価・分岐・期間）はURLのsearchParamsで状態を持つ（launch-plan.md D-8で実動作化）。
 */
export default async function AdminResponsesPage({
  searchParams,
}: {
  searchParams: { store?: string; stars?: string; branch?: string; period?: string };
}) {
  const rating = searchParams.stars ? Number(searchParams.stars) : undefined;
  const branch = BRANCHES.find((b) => b === searchParams.branch);
  const period = PERIOD_CODES.find((p) => p === searchParams.period) ?? "7d";

  const [responses, stores] = await Promise.all([
    getResponseItems({
      storeId: searchParams.store || undefined,
      rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
      branch,
      period,
    }),
    getStoreSummaries(),
  ]);

  return (
    <ResponsesView
      responses={responses}
      storeOptions={stores.map((s) => ({ id: s.id, name: s.name }))}
      filters={{ store: searchParams.store ?? "", stars: searchParams.stars ?? "", branch: branch ?? "all", period }}
    />
  );
}
