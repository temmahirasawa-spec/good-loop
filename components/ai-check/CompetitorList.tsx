"use client";

import type { Competitor } from "@/lib/ai-check/types";
import { useMounted, usePrefersReducedMotion } from "./hooks";

/**
 * 「AIが代わりに推薦しているお店」（docs/prototypes/ai-visibility-checker.html の .comp-row）。
 *
 * ⚠ ここに出る店名は、AIの回答に実際に登場した実在の店舗名になり得る。
 *   モックデータでは必ず架空の店名を使うこと（lib/ai-check/mock.ts）。
 */
export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const reduced = usePrefersReducedMotion();
  const shown = useMounted(120);

  if (competitors.length === 0) {
    return (
      <p className="text-[13.5px] leading-[2]" style={{ color: "var(--product-color-text-secondary)" }}>
        集計できる店舗リストがありませんでした。
      </p>
    );
  }

  const max = competitors[0].count || 1;

  return (
    <div>
      {competitors.map((competitor, i) => (
        <div
          key={competitor.name}
          className="flex items-center gap-[var(--product-space-12)] border-b border-solid py-[var(--product-space-8)] last:border-b-0"
          style={{ borderColor: "var(--product-color-border-divider)" }}
        >
          <p
            className="basis-[40%] truncate text-[13.5px] font-medium md:basis-[44%]"
            style={{ color: "var(--product-color-text-primary)" }}
          >
            {competitor.name}
          </p>

          <div
            className="h-[9px] flex-1 overflow-hidden rounded-[var(--product-radius-full)]"
            style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}
          >
            <div
              className="h-full rounded-[var(--product-radius-full)]"
              style={{
                width: shown ? `${Math.round((competitor.count / max) * 100)}%` : "0%",
                backgroundColor: "var(--product-color-text-primary)",
                transition: reduced ? "none" : `width 0.9s ease ${i * 0.06}s`,
              }}
            />
          </div>

          <p
            className="w-[44px] shrink-0 text-right text-base"
            style={{
              fontFamily: "var(--font-barlow), sans-serif",
              fontWeight: 600,
              color: "var(--product-color-text-primary)",
            }}
          >
            {competitor.count}
            <span
              className="ml-[var(--product-space-2)] text-[11px] font-medium"
              style={{
                fontFamily: "var(--font-noto-sans-jp), sans-serif",
                color: "var(--product-color-text-secondary)",
              }}
            >
              回
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}
