import { KpiCard } from "@/components/admin/KpiCard";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { TrendChart } from "@/components/admin/TrendChart";
import { StoreBreakdownTable } from "@/components/admin/StoreBreakdownTable";
import { STORES, ALL_STORES_TREND, TREND_WEEK_LABELS } from "@/lib/admin/mock-data";

/** Dashboard / トップ（Figma node 48:1016） */
export default function AdminTopPage() {
  return (
    <>
      <div
        className="flex w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5"
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

      <div className="flex w-full shrink-0 items-start gap-4">
        <KpiCard label="Googleレビュー増加" value="+57" prevLabel="前期 +63件" />
        <KpiCard
          label="Googleへ送客（誘導数）"
          value="103"
          prevLabel="前期 130件"
          note="レビュー画面を開いた数です。実際に投稿された数ではありません"
        />
        <KpiCard label="回答数" value="189" prevLabel="前期 218件" />
      </div>

      <div
        className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-6"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex w-full items-baseline gap-2">
          <p className="text-[17px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            Googleレビュー増加数の推移
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            直近5週
          </p>
        </div>
        <TrendChart values={ALL_STORES_TREND} labels={TREND_WEEK_LABELS} unit="" />
      </div>

      <StoreBreakdownTable stores={STORES} />
    </>
  );
}
