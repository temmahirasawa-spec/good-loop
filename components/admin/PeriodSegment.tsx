"use client";

import { useState } from "react";

/** Loop / Segment Chip・Period Segment（Figma node 39:816 / 79:1650）— 期間フィルターのピル */

/** 表示ラベルと、lib/admin/queries.ts の getResponseItems({ period }) が受け取るコードの対応 */
export const PERIOD_OPTIONS = [
  { code: "7d", label: "直近7日" },
  { code: "14d", label: "直近14日" },
  { code: "month", label: "今月" },
  { code: "90d", label: "直近3ヶ月" },
] as const;

export type PeriodCode = (typeof PERIOD_OPTIONS)[number]["code"];
export type Period = (typeof PERIOD_OPTIONS)[number]["label"];

export const PERIODS = PERIOD_OPTIONS.map((o) => o.label) as Period[];

/**
 * value/onChangeを渡さない場合は内部状態だけで動く見た目用（トップ・店舗詳細ページ）。
 * 渡した場合は親が状態を持つcontrolledな絞り込みUIになる（回答一覧ページ）。
 */
export function PeriodSegment({ value, onChange }: { value?: Period; onChange?: (period: Period) => void } = {}) {
  const [internal, setInternal] = useState<Period>(PERIODS[0]);
  const active = value ?? internal;

  function handleClick(period: Period) {
    if (onChange) onChange(period);
    else setInternal(period);
  }

  return (
    <div className="flex items-start gap-1">
      {PERIODS.map((period) => {
        const selected = period === active;
        return (
          <button
            key={period}
            type="button"
            onClick={() => handleClick(period)}
            className="flex min-h-[44px] items-center rounded-full px-5 py-3"
            style={{ backgroundColor: selected ? "var(--loop-accent-primary)" : "transparent" }}
          >
            <span
              className="whitespace-nowrap text-xs font-medium"
              style={{ color: selected ? "var(--loop-accent-on-primary)" : "var(--product-color-text-secondary)" }}
            >
              {period}
            </span>
          </button>
        );
      })}
    </div>
  );
}
