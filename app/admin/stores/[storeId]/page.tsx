import Link from "next/link";
import { KpiCard } from "@/components/admin/KpiCard";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { TrendChart } from "@/components/admin/TrendChart";
import { ResponseCard } from "@/components/admin/ResponseCard";
import { LoopButton } from "@/components/rating-flow/Button";
import { getStore, RESPONSES, TREND_WEEK_LABELS } from "@/lib/admin/mock-data";

/** Dashboard / 店舗詳細（Figma node 53:905） */
export default function AdminStoreDetailPage({ params }: { params: { storeId: string } }) {
  const store = getStore(params.storeId);
  const recentResponses = RESPONSES.filter((r) => r.storeId === store.id).slice(0, 2);
  const qrReads = 58; // Figmaのサンプル値。QR読み取り回数はまだ店舗ごとの実データが無い

  return (
    <>
      <div
        className="flex w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5"
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

      <div className="flex w-full shrink-0 items-start gap-4">
        <KpiCard label="Googleレビュー増加" value={`${store.reviewIncrease > 0 ? "+" : ""}${store.reviewIncrease}`} prevLabel={`前期 +${store.reviewIncreasePrev}件`} />
        <KpiCard
          label="Googleへ送客（誘導数）"
          value={String(Math.round(store.responseCount * 0.3))}
          prevLabel="前期 30件"
          note="レビュー画面を開いた数です。実際に投稿された数ではありません"
        />
        <KpiCard label="回答数" value={String(store.responseCount)} prevLabel={`前期 ${store.responseCountPrev}件`} />
      </div>

      <div
        className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-6"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex w-full items-baseline gap-2">
          <p className="text-[17px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            この店舗のGoogleレビュー増加数の推移
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            直近5週
          </p>
        </div>
        <TrendChart values={store.trend} labels={TREND_WEEK_LABELS} />
      </div>

      <div
        className="flex w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5"
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
            前期 63回
          </p>
        </div>
        <div className="w-fit">
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
