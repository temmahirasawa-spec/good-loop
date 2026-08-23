"use client";

import type { CheckReport } from "@/lib/ai-check/types";
import { Card, Eyebrow } from "./Card";
import { ScoreRing } from "./ScoreRing";
import { useCountUp, useMounted, usePrefersReducedMotion } from "./hooks";

/**
 * レポート冒頭の判定カード（docs/prototypes/ai-visibility-checker.html の .verdict）。
 *
 * 判定の色は2値。既存トークンに緑も赤も無いため
 * （docs/plans/ai-visibility-checker.md 9-2、2026-08-17 天真了承）。
 *   S / A / B … アクセント色
 *   C / D     … グレー
 */
export function VerdictCard({ report }: { report: CheckReport }) {
  const reduced = usePrefersReducedMotion();
  const shown = useMounted(50);

  const color =
    report.rankTone === "accent" ? "var(--loop-accent-primary)" : "var(--product-color-text-secondary)";

  const hits = useCountUp(report.hitCount, 750, shown);
  const score = useCountUp(report.score, 1100, shown);

  return (
    <Card className="relative overflow-hidden p-[var(--product-space-20)] md:p-[var(--product-space-24)]">
      <Eyebrow>Result</Eyebrow>

      {/* 右上の判定スタンプに文字が潜り込まないよう、右側を空けておく */}
      <p
        className="mt-[var(--product-space-8)] max-w-[24em] pr-[80px] text-[15px] font-medium leading-[1.9] md:pr-[96px]"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        AIへの
        <b
          className="px-[var(--product-space-2)] text-[1.35em] font-bold"
          style={{ fontFamily: "var(--font-barlow), sans-serif" }}
        >
          {report.validCount}
        </b>
        つの質問のうち、
        <br />
        「{report.store}」が登場したのは
      </p>

      <div className="flex flex-wrap items-end gap-[var(--product-space-4)]">
        <span
          className="leading-[0.95] tracking-[1px]"
          style={{
            fontFamily: "var(--font-barlow), sans-serif",
            fontWeight: 600,
            fontSize: "clamp(76px, 21vw, 116px)",
            color: "var(--product-color-text-primary)",
          }}
        >
          {hits}
        </span>
        <span
          className="pb-[var(--product-space-8)] text-[22px] font-bold"
          style={{ color: "var(--product-color-text-primary)" }}
        >
          問
        </span>
      </div>

      {/* 判定スタンプ。@keyframes を足さずに済むよう、マウント後の transition で出す */}
      <div
        className="absolute right-[var(--product-space-16)] top-[var(--product-space-20)] flex size-[74px] flex-col items-center justify-center rounded-[var(--product-radius-md)] border-[3px] border-solid md:size-[88px]"
        style={{
          color,
          borderColor: color,
          opacity: shown ? 0.92 : 0,
          transform: shown ? "rotate(-7deg) scale(1)" : "rotate(-18deg) scale(1.75)",
          transition: reduced ? "none" : "transform 0.5s cubic-bezier(0.2, 1.5, 0.4, 1), opacity 0.5s ease",
        }}
        aria-hidden
      >
        <b
          className="text-[34px] leading-none md:text-[42px]"
          style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 600 }}
        >
          {report.rank}
        </b>
        <span className="mt-[var(--product-space-2)] text-[9.5px] font-bold tracking-[0.57px]">判 定</span>
      </div>

      <div
        className="mt-[var(--product-space-12)] flex items-center gap-[var(--product-space-16)] border-t border-solid pt-[var(--product-space-16)]"
        style={{ borderColor: "var(--product-color-border-divider)" }}
      >
        <ScoreRing score={report.score} color={color} shown={shown} reducedMotion={reduced} />

        <div className="min-w-0">
          <p className="leading-none" style={{ color: "var(--product-color-text-primary)" }}>
            <span
              className="text-[40px]"
              style={{ fontFamily: "var(--font-barlow), sans-serif", fontWeight: 600 }}
            >
              {score}
            </span>
            <span
              className="ml-[var(--product-space-2)] text-base"
              style={{
                fontFamily: "var(--font-barlow), sans-serif",
                fontWeight: 600,
                color: "var(--product-color-text-secondary)",
              }}
            >
              /100
            </span>
          </p>
          <p className="mt-[var(--product-space-4)] text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
            AI視認性スコア
          </p>
          <p className="mt-[var(--product-space-2)] text-[14.5px] font-bold" style={{ color }}>
            {report.rank}判定 — {report.rankLabel}
          </p>
        </div>
      </div>
    </Card>
  );
}
