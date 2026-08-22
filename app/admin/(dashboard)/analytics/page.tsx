import { AnalyticsView } from "@/components/admin/AnalyticsView";
import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { getTagAggregates } from "@/lib/admin/queries";
import { DATE_PATTERN, PERIOD_PRESETS, type PeriodPresetCode, type PeriodValue } from "@/lib/admin/period";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

const PERIOD_CODES = PERIOD_PRESETS.map((p) => p.code) as PeriodPresetCode[];

/**
 * Dashboard / 集計（Figma `05 集計 / Analytics`）。
 *
 * アンケート項目ごとに、どれだけ選ばれたかを見る画面。仕様は docs/specs/analytics.md。
 * 店舗と期間はURLのsearchParamsで状態を持つ（回答一覧と同じ作り）。
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: { store?: string; period?: string; from?: string; to?: string };
}) {
  const from = searchParams.from && DATE_PATTERN.test(searchParams.from) ? searchParams.from : undefined;
  const to = searchParams.to && DATE_PATTERN.test(searchParams.to) ? searchParams.to : undefined;
  const preset = PERIOD_CODES.find((p) => p === searchParams.period) ?? "7d";
  const period: PeriodValue = from ? { from, to: to ?? from } : { preset };

  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);

  if (!store) {
    return (
      <AnalyticsView
        aggregates={{ good: [], improve: [], goodResponseCount: 0, improveResponseCount: 0, responseCount: 0, responseCountAllTime: 0 }}
        storeOptions={[]}
        storeId=""
        period={period}
      />
    );
  }

  const aggregates = await getTagAggregates({ storeId: store.id, period: preset, from, to });

  return (
    <AnalyticsView
      aggregates={aggregates}
      storeOptions={stores.map((s) => ({ id: s.id, name: s.name }))}
      storeId={store.id}
      period={period}
    />
  );
}
