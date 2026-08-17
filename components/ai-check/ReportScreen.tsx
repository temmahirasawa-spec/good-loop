"use client";

import type { ReactNode } from "react";
import { AiBadge } from "@/components/rating-flow/AiBadge";
import type { CheckReport } from "@/lib/ai-check/types";
import { Card, Eyebrow } from "./Card";
import { CompetitorList } from "./CompetitorList";
import { FullReportNotice } from "./FullReportNotice";
import { GhostButton } from "./GhostButton";
import { LeadForm } from "./LeadForm";
import { QuestionResultCard } from "./QuestionResultCard";
import { ShareSection } from "./ShareSection";
import { VerdictCard } from "./VerdictCard";

/**
 * 03 レポート画面（docs/prototypes/ai-visibility-checker.html の #scr-report）。
 *
 * 中身は実際のAIの応答（POST /api/checker/ask）。AI生成物であることをバッジで開示している。
 *
 * ⚠ **診断結果を第三者が見られるURLは作らない。** 共有導線（ShareSection）が共有するのは
 *   ツールのURLだけで、店名・スコア・順位は一切含めない（2026-08-17 天真の指示）。
 */

function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ReportSection({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="mt-[var(--product-space-16)]">
      <div className="flex flex-wrap items-center gap-[var(--product-space-8)] px-[var(--product-space-20)] pt-[var(--product-space-16)]">
        <Eyebrow>{no}</Eyebrow>
        <b className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </b>
      </div>
      <div
        className="mx-[var(--product-space-20)] mt-[var(--product-space-12)] h-px"
        style={{ backgroundColor: "var(--product-color-border-divider)" }}
      />
      <div className="px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]">
        {children}
      </div>
    </Card>
  );
}

export function ReportScreen({
  report,
  onRestart,
  onSubmitLead,
  onNotify,
}: {
  report: CheckReport;
  onRestart: () => void;
  onSubmitLead: (email: string) => void;
  onNotify: (message: string) => void;
}) {
  return (
    <div className="w-full pb-[var(--product-space-20)] pt-[var(--product-space-40)]">
      {/* ── 見出し ──────────────────────────────── */}
      <div className="mb-[var(--product-space-16)] flex flex-wrap items-end justify-between gap-[var(--product-space-12)]">
        <div className="min-w-0">
          <Eyebrow>AI Visibility Report</Eyebrow>
          <h2
            className="mt-[var(--product-space-4)] text-[23px] font-bold leading-[1.4]"
            style={{ color: "var(--product-color-text-primary)" }}
          >
            {report.store} 様
          </h2>
        </div>

        <div className="flex flex-col items-start gap-[var(--product-space-8)] md:items-end">
          <p className="text-xs leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
            {report.area}・{report.genre}
            <br />
            診断日時: {formatCheckedAt(report.checkedAt)}
          </p>
          {/* AIが実際に答えた結果であることを開示する（AI生成物の開示は規約上必須） */}
          <AiBadge label="Claude 実測" />
        </div>
      </div>

      <VerdictCard report={report} />

      <ReportSection no="01 · Questions" title="質問別の結果">
        {report.errorCount > 0 && (
          <p className="mb-[var(--product-space-8)] text-xs leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
            ※ {report.errorCount}問は取得に失敗したため、スコア集計から除外しています。
          </p>
        )}
        {report.questions.map((result) => (
          <QuestionResultCard key={result.index} result={result} store={report.store} />
        ))}
      </ReportSection>

      <ReportSection no="02 · Instead of You" title="AIが代わりに推薦しているお店">
        <CompetitorList competitors={report.competitors} />
      </ReportSection>

      <ReportSection no="03 · Why" title="要因分析">
        <FullReportNotice />
      </ReportSection>

      <ReportSection no="04 · Summary" title="総評">
        <p className="text-[13.5px] leading-[2]" style={{ color: "var(--product-color-text-secondary)" }}>
          {report.summary}
        </p>
      </ReportSection>

      <div className="mt-[var(--product-space-16)]">
        <LeadForm onSubmit={onSubmitLead} />
      </div>

      <div className="mt-[var(--product-space-16)]">
        <ShareSection onNotify={onNotify} />
      </div>

      <div className="mx-auto mt-[var(--product-space-16)] max-w-[360px]">
        <GhostButton onClick={onRestart}>条件を変えてもう一度チェックする</GhostButton>
      </div>
    </div>
  );
}
