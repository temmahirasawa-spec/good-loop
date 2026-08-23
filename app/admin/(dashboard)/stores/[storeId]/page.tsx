import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { KpiCard, toDelta } from "@/components/admin/KpiCard";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { TrendChart } from "@/components/admin/TrendChart";
import { ResponseCard } from "@/components/admin/ResponseCard";
import { LoopButton } from "@/components/rating-flow/Button";
import { TREND_WEEK_LABELS } from "@/lib/admin/constants";
import { routeRate } from "@/lib/admin/metrics";
import { getStoreSummary, getResponseItems } from "@/lib/admin/queries";

/** Dashboard / 店舗詳細（Figma node 53:905 PC / 54:926 SP） */
export default async function AdminStoreDetailPage({ params }: { params: { storeId: string } }) {
  const store = await getStoreSummary(params.storeId);
  if (!store) notFound();
  const prevRate = store.routeRatePercent === null ? null : routeRate(store.routeCountPrev, store.responseCountPrev);
  const recentResponses = await getResponseItems({ storeId: store.id, limit: 2 });
  const qrReads = store.qrReads;

  return (
    <>
      <AdminMobileTopBar title={store.name} backHref="/admin" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex flex-col items-start gap-2">
          <Link href="/admin" className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            ← トップに戻る
          </Link>
          <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {store.name}
          </p>
        </div>
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
          value={String(store.routeCount)}
          prevLabel={`前期 ${store.routeCountPrev}件`}
          delta={toDelta(store.routeCount, store.routeCountPrev, "件")}
          note="レビュー画面を開いた数です。実際に投稿された数ではありません"
        />
        <KpiCard
          label="回答数"
          note="アンケートに答えていただいた数です"
          value={String(store.responseCount)}
          prevLabel={`前期 ${store.responseCountPrev}件`}
          delta={toDelta(store.responseCount, store.responseCountPrev, "件")}
        />
        <KpiCard
          label="送客率"
          value={store.routeRatePercent === null ? "—" : `${store.routeRatePercent}%`}
          prevLabel={`前期 ${prevRate === null ? "—" : `${prevRate}%`}`}
          delta={toDelta(store.routeRatePercent, prevRate, "pt")}
          unit=""
          note="回答したお客様のうち、Googleのレビュー画面へ進んだ割合です"
        />
      </div>

      <div
        className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-4 md:p-6"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex w-full items-baseline gap-2">
          <p className="text-[15px] font-bold md:text-[17px]" style={{ color: "var(--product-color-text-primary)" }}>
            この店舗のGoogleへの送客数の推移
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            直近5週
          </p>
        </div>
        <TrendChart values={store.trend} labels={TREND_WEEK_LABELS} />
      </div>

      {/* PC: 横並び */}
      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            二次元コードの読み取り
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-[32px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {qrReads}
            </p>
            <p className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              回
            </p>
          </div>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
            前期 {store.qrReadsPrev}回
          </p>
        </div>
        <div className="w-fit">
          <LoopButton variant="primary">この店舗の二次元コードを表示</LoopButton>
        </div>
      </div>
      {/* SP: 縦積み（Figma node 54:1121） */}
      <div
        className="flex w-full shrink-0 flex-col items-start gap-3 rounded-2xl p-4 md:hidden"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          二次元コードの読み取り
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-[28px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {qrReads}
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            回
          </p>
          <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
            前期 {store.qrReadsPrev}回
          </p>
        </div>
        <div className="w-full">
          <LoopButton variant="primary">この店舗の二次元コードを表示</LoopButton>
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        <div className="flex w-full items-center justify-between">
          <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            直近の回答
          </p>
          <Link href="/admin/responses" className="text-[13px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
            すべての回答を見る →
          </Link>
        </div>
        {recentResponses.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--product-color-text-tertiary)" }}>
            まだ回答がありません
          </p>
        ) : (
          recentResponses.map((r) => <ResponseCard key={r.id} response={r} showStoreName={false} />)
        )}
      </div>
    </>
  );
}
