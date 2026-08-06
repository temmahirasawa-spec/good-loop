import Link from "next/link";
import type { StoreSummary } from "@/lib/admin/types";

/** 店舗別内訳（Figma node 48:1084 PC / 48:1266 SP） */
export function StoreBreakdownTable({ stores }: { stores: StoreSummary[] }) {
  const cols = ["店舗名", "Googleへ送客", "送客率（前期比）", "回答数（前期比）", "平均評価"];

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

      {/* PC: テーブル形式 */}
      <div className="hidden w-full flex-col items-start gap-2 md:flex">
        <div className="flex w-full items-start gap-4 px-6 py-1">
          {cols.map((col) => (
            <p key={col} className="flex-1 whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
              {col}
            </p>
          ))}
        </div>
        {stores.map((store) => (
          <Link
            key={store.id}
            href={`/admin/stores/${store.id}`}
            className="flex w-full items-center gap-4 rounded-2xl px-6 py-5"
            style={{ backgroundColor: "var(--product-color-surface-white)" }}
          >
            <div className="flex-1">
              <p className="whitespace-nowrap text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {store.name}
              </p>
            </div>
            <div className="flex flex-1 items-center gap-1 whitespace-nowrap">
              <p className="text-xl font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                {store.routeCount}
              </p>
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                件
              </p>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <p className="whitespace-nowrap text-sm font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                {store.routeRatePercent === null ? "—" : `${store.routeRatePercent}%`}
              </p>
              <div className="flex items-start rounded-full px-3 py-1" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}>
                <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-secondary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.routeRateDeltaPt === null ? "判定不能" : `${store.routeRateDeltaPt > 0 ? "+" : ""}${store.routeRateDeltaPt}pt`}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-start gap-0.5 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.responseCount}
                </p>
                <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                  件
                </p>
              </div>
              <div className="flex items-center gap-1" style={{ color: "var(--product-color-text-tertiary)" }}>
                <p className="text-[11px] font-medium">前期</p>
                <p className="text-xs font-medium" style={{ fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.responseCountPrev}
                </p>
                <p className="text-[11px] font-medium">件</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-1 whitespace-nowrap">
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                {store.avgRating.toFixed(1)}
              </p>
              <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                / 5.0
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* SP: カード形式（Figma node 48:1270 等） */}
      <div className="flex w-full flex-col items-start gap-2 md:hidden">
        {stores.map((store) => (
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
              <div className="flex items-center gap-1">
                <p className="text-xs" style={{ color: "var(--product-color-text-secondary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.avgRating.toFixed(1)}
                </p>
                <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  / 5.0
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
              <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                Googleへ送客
              </p>
              <div className="flex items-center gap-1">
                <p className="text-xl font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                  {store.routeCount}
                </p>
                <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                  件
                </p>
              </div>
            </div>
            <div className="flex w-full items-start gap-4">
              <div className="flex flex-1 flex-col items-start gap-0.5">
                <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  送客率
                </p>
                <div className="flex items-center gap-2">
                  <p className="whitespace-nowrap text-sm font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                    {store.routeRatePercent === null ? "—" : `${store.routeRatePercent}%`}
                  </p>
                  <div className="flex items-start rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}>
                    <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-secondary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                      {store.routeRateDeltaPt === null ? "判定不能" : `${store.routeRateDeltaPt > 0 ? "+" : ""}${store.routeRateDeltaPt}pt`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col items-start gap-0.5 whitespace-nowrap">
                <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  回答数
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--product-color-text-primary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                    {store.responseCount}
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                    件
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                    前期
                  </p>
                  <p className="text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)", fontFamily: "var(--font-barlow), sans-serif" }}>
                    {store.responseCountPrev}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
