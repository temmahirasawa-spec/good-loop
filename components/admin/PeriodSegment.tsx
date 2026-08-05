"use client";

import { useState } from "react";

/** Loop / Segment Chip・Period Segment（Figma node 39:816 / 79:1650）— 期間フィルターのピル */
const PERIODS = ["直近7日", "直近14日", "今月", "直近3ヶ月"];

export function PeriodSegment() {
  const [active, setActive] = useState(PERIODS[0]);

  return (
    <div className="flex items-start gap-1">
      {PERIODS.map((period) => {
        const selected = period === active;
        return (
          <button
            key={period}
            type="button"
            onClick={() => setActive(period)}
            className="flex items-center rounded-full px-5 py-[13px]"
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
