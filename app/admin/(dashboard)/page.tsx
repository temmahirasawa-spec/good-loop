import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { KpiCard } from "@/components/admin/KpiCard";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { TrendChart } from "@/components/admin/TrendChart";
import { StoreBreakdownTable } from "@/components/admin/StoreBreakdownTable";
import { TREND_WEEK_LABELS } from "@/lib/admin/constants";
import { totals, sumTrend } from "@/lib/admin/metrics";
import { getStoreSummaries } from "@/lib/admin/queries";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/** Dashboard / トップ（Figma node 48:1016 PC / 48:1210 SP） */
export default async function AdminTopPage() {
  const stores = await getStoreSummaries();
  const total = totals(stores);
  const allStoresTrend = sumTrend(stores);

  return (
    <>
      <AdminMobileTopBar title="トップ" storeName="YORKYS BRUNCH" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          トップ
        </p>
        <div className="flex flex-col items-end gap-2">
          <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
            期間
          </p>
          <PeriodSegment />
        </div>
      </div>
      <div
        className="flex w-full shrink-0 flex-col items-start gap-2 rounded-2xl p-4 md:hidden"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          期間
        </p>
        <PeriodSegment />
      </div>

      <div className="flex w-full shrink-0 flex-col items-start gap-2 md:flex-row md:gap-4">
        <KpiCard
          label="Googleへ送客（誘導数）"
          value={String(total.routeCount)}
          prevLabel={`前期 ${total.routeCountPrev}件`}
          note="レビュー画面を開いた数です。実際に投稿された数ではありません"
        />
        <KpiCard label="回答数" value={String(total.responseCount)} prevLabel={`前期 ${total.responseCountPrev}件`} />
        <KpiCard
          label="送客率"
          value={total.routeRatePercent === null ? "—" : `${total.routeRatePercent}%`}
          prevLabel={`前期 ${total.routeRatePercentPrev === null ? "—" : `${total.routeRatePercentPrev}%`}`}
          unit=""
        />
      </div>

      <div
        className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-4 md:p-6"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex w-full items-baseline gap-2">
          <p className="text-[15px] font-bold md:text-[17px]" style={{ color: "var(--product-color-text-primary)" }}>
            Googleへの送客数の推移
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            直近5週
          </p>
        </div>
        <TrendChart values={allStoresTrend} labels={TREND_WEEK_LABELS} unit="" />
      </div>

      <StoreBreakdownTable stores={stores} />
    </>
  );
}
