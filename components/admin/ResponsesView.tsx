"use client";

import { useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { ResponseCard } from "@/components/admin/ResponseCard";
import type { ResponseItem } from "@/lib/admin/types";

const ROUTE_FILTERS = ["すべて", "★5・4", "★3・2・1"];

function StoreRatingSelects() {
  return (
    <>
      <div
        className="flex h-11 flex-1 items-center justify-between rounded-xl border pl-4 pr-3 md:w-[180px] md:flex-none"
        style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--product-color-text-primary)" }}>
          すべての店舗
        </p>
        <p className="text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
          ▾
        </p>
      </div>
      <div
        className="flex h-11 flex-1 items-center justify-between rounded-xl border pl-4 pr-3 md:w-[150px] md:flex-none"
        style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--product-color-text-primary)" }}>
          すべての評価
        </p>
        <p className="text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
          ▾
        </p>
      </div>
    </>
  );
}

/**
 * Dashboard / 回答一覧（Figma node 51:883 PC / 52:899 SP）の表示部分。
 * データ取得は親（app/admin/(dashboard)/responses/page.tsx）が行う。
 *
 * フィルター（店舗・評価・送客状況）・期間はまだ見た目のみで、実際の絞り込みは動かない
 * （launch-plan.md D-8。この画面は「実データを出す」までがフェーズ4のスコープ）。
 */
export function ResponsesView({ responses }: { responses: ResponseItem[] }) {
  const [routeFilter, setRouteFilter] = useState(ROUTE_FILTERS[0]);

  const routeSegment = (
    <div className="flex items-start gap-1">
      {ROUTE_FILTERS.map((f) => {
        const selected = f === routeFilter;
        return (
          <button
            key={f}
            type="button"
            onClick={() => setRouteFilter(f)}
            className="flex items-center rounded-full px-5 py-[13px]"
            style={{ backgroundColor: selected ? "var(--loop-accent-primary)" : "transparent" }}
          >
            <span className="whitespace-nowrap text-xs font-medium" style={{ color: selected ? "var(--loop-accent-on-primary)" : "var(--product-color-text-secondary)" }}>
              {f}
            </span>
          </button>
        );
      })}
    </div>
  );

  const countLabel = `${responses.length}件の回答`;

  return (
    <>
      <AdminMobileTopBar title="回答一覧" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          回答一覧
        </p>
        <div className="flex items-center gap-4">
          <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {countLabel}
          </p>
          <PeriodSegment />
        </div>
      </div>
      <p className="whitespace-nowrap text-[13px] font-medium md:hidden" style={{ color: "var(--product-color-text-secondary)" }}>
        {countLabel}
      </p>

      <div className="flex w-full shrink-0 items-center gap-3">
        <StoreRatingSelects />
        <div className="hidden md:flex">{routeSegment}</div>
      </div>
      <div className="flex w-full flex-col items-start gap-3 md:hidden">
        {routeSegment}
        <PeriodSegment />
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        {responses.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--product-color-text-tertiary)" }}>
            まだ回答がありません
          </p>
        ) : (
          responses.map((r) => <ResponseCard key={r.id} response={r} />)
        )}
      </div>
    </>
  );
}
