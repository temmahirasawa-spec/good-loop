"use client";

import { useState } from "react";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { ResponseCard } from "@/components/admin/ResponseCard";
import { RESPONSES } from "@/lib/admin/mock-data";

const ROUTE_FILTERS = ["すべて", "★5・4", "★3・2・1"];

/** Dashboard / 回答一覧（Figma node 51:883） */
export default function AdminResponsesPage() {
  const [routeFilter, setRouteFilter] = useState(ROUTE_FILTERS[0]);

  return (
    <>
      <div
        className="flex w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          回答一覧
        </p>
        <div className="flex items-center gap-4">
          <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            246件の回答
          </p>
          <PeriodSegment />
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center gap-3">
        <div
          className="flex h-11 w-[180px] items-center justify-between rounded-xl border pl-4 pr-3"
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
          className="flex h-11 w-[150px] items-center justify-between rounded-xl border pl-4 pr-3"
          style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
        >
          <p className="text-[13px]" style={{ color: "var(--product-color-text-primary)" }}>
            すべての評価
          </p>
          <p className="text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
            ▾
          </p>
        </div>
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
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        {RESPONSES.map((r) => (
          <ResponseCard key={r.id} response={r} />
        ))}
      </div>
    </>
  );
}
