"use client";

import type { ReactNode } from "react";
import { AiBadge } from "@/components/rating-flow/AiBadge";
import type { CheckReport } from "@/lib/ai-check/types";
import { Card, Eyebrow } from "./Card";
import { CompetitorList } from "./CompetitorList";
import { FactorTeaser } from "./FactorTeaser";
import { GhostButton } from "./GhostButton";
import { LeadForm } from "./LeadForm";
import { LockedContent } from "./LockedContent";
import { Pill } from "./Pill";
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

/** メールアドレス欄の位置。鍵のかかった区画から運ぶために使う */
const LEAD_FORM_ID = "ai-check-lead-form";

/**
 * メールアドレス欄まで運んで、入力できる状態にする。
 * 共通部品の `ReviewInput` は id を受け取らないため、囲みの要素から辿っている。
 */
function goToLeadForm() {
  const target = document.getElementById(LEAD_FORM_ID);
  if (!target) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  // スクロールの途中で焦点を移すと位置が飛ぶので、少し待ってから
  window.setTimeout(() => target.querySelector("input")?.focus(), reduced ? 0 : 500);
}

function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ReportSection({
  no,
  title,
  badge,
  children,
}: {
  no: string;
  title: string;
  /** 見出しの右に出す小さな印（「サンプル」など） */
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mt-[var(--product-space-16)]">
      <div className="flex flex-wrap items-center gap-[var(--product-space-8)] px-[var(--product-space-20)] pt-[var(--product-space-16)]">
        <Eyebrow>{no}</Eyebrow>
        <b className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </b>
        {badge}
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

      {/*
        ⚠ 「サンプル」の印を外さないこと。中の点数は架空で、実測していない
          （components/ai-check/FactorTeaser.tsx の冒頭を参照）。
      */}
      <ReportSection no="03 · Why" title="要因分析" badge={<Pill tone="muted">サンプル</Pill>}>
        {/*
          ⚠ この一文を消さないこと。中の点数は架空で、実測していない。
            ぼかしの外（必ず読める位置）に置いてある。
        */}
        <p
          className="mb-[var(--product-space-12)] text-xs leading-[1.8]"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          ※ この項目は<b className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>表示例</b>です。あなたのお店を測った値ではありません。実測はフルレポートでお送りします。
        </p>
        <LockedContent visibleHeight={244} onUnlock={goToLeadForm}>
          <FactorTeaser />
        </LockedContent>
      </ReportSection>

      <ReportSection no="04 · Summary" title="総評">
        <LockedContent visibleHeight={120} onUnlock={goToLeadForm}>
          {/* 実測から組み立てた本物の総評。ここは必ず読める位置に置く */}
          <p className="text-[13.5px] leading-[2]" style={{ color: "var(--product-color-text-secondary)" }}>
            {report.summary}
          </p>
          {/*
            この先はフルレポートの内容の予告。
            ⚠ 店舗別に見える数値や断定を書かないこと。ここは「何をするか」の説明であって、
              測っていないことを測ったように書くと作り話になる。
          */}
          <p
            className="mt-[var(--product-space-12)] text-[13.5px] leading-[2]"
            style={{ color: "var(--product-color-text-secondary)" }}
          >
            フルレポートでは、登場しなかった質問に共通する文脈を洗い出し、AIが参照している情報源のどこに空白があるのかを整理します。あわせて、次の30日で着手する順番を、費用のかからないものから並べてご提案します。今の状態を起点に、何をどの順で埋めていくかが分かる形でお送りします。
          </p>
        </LockedContent>
      </ReportSection>

      <div className="mt-[var(--product-space-16)]" id={LEAD_FORM_ID}>
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
