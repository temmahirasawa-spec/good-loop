import Link from "next/link";
import type { StoreSummary } from "@/lib/admin/types";
import { toDelta, type KpiDelta } from "@/components/admin/KpiCard";

/** 増減の色と記号（KPIカードと同じ文法。1895937572） */
const DELTA_COLOR: Record<KpiDelta["direction"], string> = {
  up: "var(--loop-accent-action)",
  down: "var(--product-color-status-warning)",
  flat: "var(--product-color-text-tertiary)",
};
const DELTA_MARK: Record<KpiDelta["direction"], string> = { up: "\u25b2", down: "\u25bc", flat: "\u2014" };

function DeltaText({ delta }: { delta?: KpiDelta }) {
  if (!delta) return null;
  return (
    <p className="whitespace-nowrap text-[11px] font-bold" style={{ color: DELTA_COLOR[delta.direction] }}>
      {DELTA_MARK[delta.direction]} {delta.text}
    </p>
  );
}

/** 店舗別内訳（Figma node 48:1084 PC / 48:1266 SP） */
export function StoreBreakdownTable({ stores }: { stores: StoreSummary[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <div>
        <p className="text-[17px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          店舗別内訳
        </p>
        <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          店舗名順
        </p>
      </div>

      {/*
        PC: テーブル形式。2026-08-23、SPカードと同じ文法（各セルにラベル・大きな数字・
        色付きの増減・★平均）に同期した（Figmaコメント 1895943084）。列ヘッダー行は
        各セルがラベルを持つため廃止。
      */}
      <div className="hidden w-full flex-col items-start gap-2 md:flex">
        {stores.map((store) => {
          const routeDelta = toDelta(store.routeCount, store.routeCountPrev, "件");
          const responseDelta = toDelta(store.responseCount, store.responseCountPrev, "件");
          const rateDelta: KpiDelta | undefined =
            store.routeRateDeltaPt === null
              ? undefined
              : store.routeRateDeltaPt === 0
                ? { text: "前期と同じ", direction: "flat" }
                : {
                    text: `${store.routeRateDeltaPt > 0 ? "+" : "\u2212"}${Math.abs(store.routeRateDeltaPt)}pt`,
                    direction: store.routeRateDeltaPt > 0 ? "up" : "down",
                  };
          const stats: { label: string; value: string; unit?: string; delta?: KpiDelta }[] = [
            { label: "回答数", value: String(store.responseCount), unit: "件", delta: responseDelta },
            { label: "Googleへ送客", value: String(store.routeCount), unit: "件", delta: routeDelta },
            { label: "送客率", value: store.routeRatePercent === null ? "\u2014" : `${store.routeRatePercent}%`, delta: rateDelta },
          ];
          return (
            <Link
              key={store.id}
              href={`/admin/stores/${store.id}`}
              className="flex w-full items-center gap-6 rounded-2xl px-6 py-5"
              style={{ backgroundColor: "var(--product-color-surface-white)" }}
            >
              <p className="w-[180px] shrink-0 whitespace-nowrap text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {store.name}
              </p>
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-1 flex-col items-start gap-1">
                  <p className="whitespace-nowrap text-[10.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    {stat.label}
                  </p>
                  <div className="flex items-baseline gap-0.5">
                    <p className="text-[22px] font-bold leading-none" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                      {stat.value}
                    </p>
                    {stat.unit && (
                      <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                        {stat.unit}
                      </p>
                    )}
                  </div>
                  <DeltaText delta={stat.delta} />
                </div>
              ))}
              <div className="flex shrink-0 items-baseline gap-1">
                <p className="text-xs" style={{ color: "var(--product-color-icon-yellow)" }}>
                  ★
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.avgRating.toFixed(1)}
                </p>
                <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  / 5.0
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/*
        SP: カード形式。2026-08-23、KPIカードと同じ文法（ライン・増減の色・数字のメリハリ）で
        作り直した（Figmaコメント 1895937572「このカードコンポーネント読みにくすぎる」）。
      */}
      <div className="flex w-full flex-col items-start gap-2 md:hidden">
        {stores.map((store) => {
          const routeDelta = toDelta(store.routeCount, store.routeCountPrev, "件");
          const responseDelta = toDelta(store.responseCount, store.responseCountPrev, "件");
          const rateDelta: KpiDelta | undefined =
            store.routeRateDeltaPt === null
              ? undefined
              : store.routeRateDeltaPt === 0
                ? { text: "前期と同じ", direction: "flat" }
                : {
                    text: `${store.routeRateDeltaPt > 0 ? "+" : "\u2212"}${Math.abs(store.routeRateDeltaPt)}pt`,
                    direction: store.routeRateDeltaPt > 0 ? "up" : "down",
                  };
          return (
            <Link
              key={store.id}
              href={`/admin/stores/${store.id}`}
              className="flex w-full flex-col items-start gap-3 rounded-2xl p-4"
              style={{ backgroundColor: "var(--product-color-surface-white)" }}
            >
              <div className="flex w-full items-center justify-between whitespace-nowrap">
                <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                  {store.name}
                </p>
                <div className="flex items-baseline gap-1">
                  <p className="text-xs" style={{ color: "var(--product-color-icon-yellow)" }}>
                    ★
                  </p>
                  <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                    {store.avgRating.toFixed(1)}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    / 5.0
                  </p>
                </div>
              </div>

              <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

              <div className="flex w-full items-start gap-3">
                <div className="flex flex-1 flex-col items-start gap-1">
                  <p className="whitespace-nowrap text-[10.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    回答数
                  </p>
                  <div className="flex items-baseline gap-0.5">
                    <p className="text-[22px] font-bold leading-none" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                      {store.responseCount}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                      件
                    </p>
                  </div>
                  <DeltaText delta={responseDelta} />
                </div>
                <div className="flex flex-1 flex-col items-start gap-1">
                  <p className="whitespace-nowrap text-[10.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    Googleへ送客
                  </p>
                  <div className="flex items-baseline gap-0.5">
                    <p className="text-[22px] font-bold leading-none" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                      {store.routeCount}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                      件
                    </p>
                  </div>
                  <DeltaText delta={routeDelta} />
                </div>
                <div className="flex flex-1 flex-col items-start gap-1">
                  <p className="whitespace-nowrap text-[10.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    送客率
                  </p>
                  <p className="text-[22px] font-bold leading-none" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                    {store.routeRatePercent === null ? "\u2014" : `${store.routeRatePercent}%`}
                  </p>
                  <DeltaText delta={rateDelta} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
