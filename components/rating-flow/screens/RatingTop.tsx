"use client";

import { Header } from "../Header";
import { ProgressBar } from "../ProgressBar";
import { RatingButton } from "../RatingButton";
import { LoopButton } from "../Button";

/** 01 / 評価トップ（Figma node 1:324） */
export function RatingTop({
  storeName,
  rating,
  onSelect,
  onSubmit,
  showValidationError,
}: {
  storeName: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  onSelect: (level: 1 | 2 | 3 | 4 | 5) => void;
  onSubmit: () => void;
  showValidationError: boolean;
}) {
  return (
    <div
      className="flex size-full flex-col items-start justify-between px-[var(--product-space-24)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <ProgressBar step={1} />
      <div className="h-12 w-full shrink-0" />
      <Header storeName={storeName} />
      <div className="h-24 w-full shrink-0" />

      <div className="flex w-full max-w-[342px] flex-col items-start gap-[var(--product-space-24)]">
        <div className="flex w-full flex-col items-start gap-[var(--product-space-12)]">
          <div className="flex w-full flex-col items-center">
            <div
              className="rounded-full px-[var(--product-space-16)] py-[var(--product-space-8)]"
              style={{ backgroundColor: "var(--loop-accent-wash)" }}
            >
              <p
                className="whitespace-nowrap text-[11px] font-medium tracking-[0.22px]"
                style={{ color: "var(--loop-accent-action)" }}
              >
                所要時間は約1分です
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col items-center gap-[var(--product-space-4)] text-center">
            <p className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
              本日の体験はいかがでしたか？
            </p>
            <p className="text-sm font-medium tracking-[0.14px]" style={{ color: "var(--product-color-text-tertiary)" }}>
              当てはまるものをタップしてください
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-[var(--product-space-12)]">
          <div className="flex w-full items-start gap-[var(--product-space-12)]">
            <RatingButton level={5} selected={rating === 5} onSelect={() => onSelect(5)} />
            <RatingButton level={4} selected={rating === 4} onSelect={() => onSelect(4)} />
          </div>
          <div className="flex w-full items-start gap-[var(--product-space-12)]">
            <RatingButton level={3} selected={rating === 3} onSelect={() => onSelect(3)} />
            <RatingButton level={2} selected={rating === 2} onSelect={() => onSelect(2)} />
            <RatingButton level={1} selected={rating === 1} onSelect={() => onSelect(1)} />
          </div>
        </div>

        {showValidationError && (
          // エラー（危険色）のトークンがデザインシステムにまだ無いため、暫定で text-secondary を使っている。
          // Figmaにもこの状態のフレームは無い。危険色を追加するかは天真確認が必要（CLAUDE.md 3章）
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
            評価を選んでください
          </p>
        )}
      </div>

      <div className="min-h-px w-full flex-1" />

      <div className="flex w-full max-w-[342px] flex-col items-center gap-[var(--product-space-12)]">
        <LoopButton variant="primary" onClick={onSubmit}>
          回答する
        </LoopButton>
        <p
          className="w-full text-center text-[11px] font-medium tracking-[0.22px]"
          style={{ color: "var(--product-color-text-tertiary)" }}
        >
          ご回答は店舗の改善に活用させていただきます
        </p>
      </div>
    </div>
  );
}
