"use client";

import { CheckCircleFilledIcon, PencilIcon } from "../icons";
import { AiBadge } from "../AiBadge";
import { StepNumber } from "../StepNumber";
import { LoopButton } from "../Button";

export const REGENERATE_LIMIT = 5;

export type DraftStatus = "generating" | "ready" | "fallback";

/** 03 / 下書き結果・コピー（Figma node 1:382） */
export function DraftResult({
  status,
  draftText,
  onDraftTextChange,
  regenerating,
  regenerateCount,
  onRegenerate,
  copied,
  onCopy,
  onOpenGoogle,
}: {
  status: DraftStatus;
  draftText: string;
  onDraftTextChange: (value: string) => void;
  regenerating: boolean;
  regenerateCount: number;
  onRegenerate: () => void;
  copied: boolean;
  onCopy: () => void;
  onOpenGoogle: () => void;
}) {
  const generating = status === "generating";
  const regenerateDisabled = regenerating || generating || regenerateCount >= REGENERATE_LIMIT;
  const remaining = REGENERATE_LIMIT - regenerateCount;
  const showRemainingWarning = regenerateCount >= 3 && regenerateCount < REGENERATE_LIMIT;

  return (
    <div
      className="flex size-full flex-col items-start gap-[var(--product-space-40)] px-[var(--product-space-24)] pb-[var(--product-space-112)] pt-[var(--product-space-48)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <div className="flex w-full max-w-[342px] flex-col items-center gap-[var(--product-space-24)]">
        <div className="flex w-full flex-col items-center gap-[var(--product-space-20)]">
          <CheckCircleFilledIcon className="size-16 shrink-0" style={{ color: "var(--loop-accent-primary)" }} />
          <p className="text-center text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
            ありがとうございました！
          </p>
        </div>

        <div className="h-px w-[238px]" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

        <div className="flex w-full flex-col items-start gap-[var(--product-space-8)] text-center">
          <p className="w-full text-[17px] font-bold tracking-[0.17px]" style={{ color: "var(--product-color-text-primary)" }}>
            Googleの口コミに投稿しませんか？
          </p>
          <p className="w-full text-sm font-medium leading-[1.8] tracking-[0.14px]" style={{ color: "var(--product-color-text-secondary)" }}>
            いただいたクチコミは
            <br />
            お店の大きな励みになります
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-[var(--product-space-8)]">
          <div className="flex w-full flex-col items-center">
            {status === "fallback" ? (
              <p className="text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-text-tertiary)" }}>
                あなたの回答をもとに下書きを作成しました
              </p>
            ) : (
              <AiBadge label="AIが下書きを作成しました" />
            )}
          </div>

          <div className="flex w-full flex-col items-start gap-[var(--product-space-8)]">
            <div
              className="w-full rounded-[14px] border-solid px-[var(--product-space-16)] py-[var(--product-space-12)]"
              style={{ borderWidth: 1.5, borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
            >
              {generating ? (
                <div className="flex flex-col gap-2 py-1" aria-live="polite" aria-busy="true">
                  <div className="h-3.5 w-full animate-pulse rounded" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }} />
                  <div className="h-3.5 w-full animate-pulse rounded" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }} />
                  <div className="h-3.5 w-2/3 animate-pulse rounded" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }} />
                </div>
              ) : (
                <textarea
                  value={draftText}
                  onChange={(e) => onDraftTextChange(e.target.value)}
                  disabled={regenerating}
                  rows={5}
                  className="w-full resize-none border-none bg-transparent text-sm font-medium leading-[1.8] tracking-[0.14px] outline-none"
                  style={{ color: "var(--product-color-text-primary)" }}
                />
              )}
            </div>

            {!generating && (
              <div className="flex w-full items-start justify-between gap-[var(--product-space-8)]">
                <div className="flex items-center gap-[var(--product-space-4)] px-[var(--product-space-2)]">
                  <PencilIcon className="size-[13px] shrink-0" />
                  <p className="whitespace-nowrap text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-text-tertiary)" }}>
                    タップして自由に編集できます
                  </p>
                </div>
                <LoopButton variant="regenerate" disabled={regenerateDisabled} onClick={onRegenerate} />
              </div>
            )}
            {showRemainingWarning && (
              <p className="w-full text-right text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-text-secondary)" }}>
                あと{remaining}回まで再生成できます
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-[342px] flex-col items-start gap-[var(--product-space-16)]">
        <div className="flex w-full items-center gap-[var(--product-space-12)]">
          <StepNumber number={1} active={!copied} />
          <div className="flex-1">
            <LoopButton variant="copy" copied={copied} onClick={onCopy} />
          </div>
        </div>
        <div className="flex w-full items-center gap-[var(--product-space-12)]">
          <StepNumber number={2} active={copied} />
          <div className="flex-1">
            <LoopButton variant="google" disabled={!copied} onClick={onOpenGoogle} />
          </div>
        </div>
        <div className="flex w-full items-center gap-[var(--product-space-12)]">
          <StepNumber number={3} active={false} />
          <p className="flex-1 text-sm font-medium tracking-[0.14px]" style={{ color: "var(--product-color-text-secondary)" }}>
            クチコミ欄に貼り付けて投稿
          </p>
        </div>
      </div>
    </div>
  );
}
