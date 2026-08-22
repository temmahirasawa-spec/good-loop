import { ResponsesView } from "@/components/admin/ResponsesView";
import { getResponseItems, getStoreSummaries } from "@/lib/admin/queries";
import { DATE_PATTERN, PERIOD_PRESETS, type PeriodPresetCode, type PeriodValue } from "@/lib/admin/period";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

const PERIOD_CODES = PERIOD_PRESETS.map((p) => p.code) as PeriodPresetCode[];

const BRANCHES = ["good", "improve"] as const;

/**
 * Dashboard / 回答一覧（Figma node 51:883 PC / 52:899 SP）。
 *
 * フィルター（店舗・評価・分岐・期間）はURLのsearchParamsで状態を持つ（launch-plan.md D-8で実動作化）。
 */
export default async function AdminResponsesPage({
  searchParams,
}: {
  searchParams: { store?: string; branch?: string; period?: string; from?: string; to?: string };
}) {
  const branch = BRANCHES.find((b) => b === searchParams.branch);
  const from = searchParams.from && DATE_PATTERN.test(searchParams.from) ? searchParams.from : undefined;
  const to = searchParams.to && DATE_PATTERN.test(searchParams.to) ? searchParams.to : undefined;
  const preset = PERIOD_CODES.find((p) => p === searchParams.period) ?? "7d";
  const period: PeriodValue = from ? { from, to: to ?? from } : { preset };

  const [responses, stores] = await Promise.all([
    getResponseItems({
      storeId: searchParams.store || undefined,
      branch,
      period: preset,
      from,
      to,
    }),
    getStoreSummaries(),
  ]);

  return (
    <ResponsesView
      responses={responses}
      storeOptions={stores.map((s) => ({ id: s.id, name: s.name }))}
      filters={{ store: searchParams.store ?? "", branch: branch ?? "all", period }}
    />
  );
}
