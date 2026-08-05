"use client";

import { Header } from "../Header";
import { ProgressBar } from "../ProgressBar";
import { TagChip } from "../TagChip";
import { LoopButton } from "../Button";

export const GOOD_TAGS = ["料理・味", "接客・スタッフ", "雰囲気・内装", "コスパ", "清潔感", "提供スピード"] as const;

/**
 * 02 / 良かった点（Figma node 1:360）
 * タグを1つ選ぶまで「回答する」は非活性（2026-08-05 天真指示。01画面と同様のルール）。
 * 自由記述は任意のままなので、タグ0件のままでは送信できない
 */
export function GoodFeedback({
  storeName,
  selectedTags,
  onToggleTag,
  freeText,
  onFreeTextChange,
  submitting,
  error,
  onSubmit,
}: {
  storeName: string;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  submitting: boolean;
  error?: string;
  onSubmit: () => void;
}) {
  const rows = [GOOD_TAGS.slice(0, 2), GOOD_TAGS.slice(2, 4), GOOD_TAGS.slice(4, 6)];

  return (
    <div
      className="flex w-full flex-1 flex-col items-start px-[var(--product-space-24)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <ProgressBar step={2} />
      <div className="h-12 w-full shrink-0" />
      <Header storeName={storeName} />
      <div className="h-24 w-full shrink-0" />

      <div className="flex w-full max-w-[342px] flex-col items-start gap-[var(--product-space-24)]">
        <div className="flex w-full flex-col items-center gap-[var(--product-space-8)] text-center">
          <p className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
            ありがとうございます！
          </p>
          <p className="text-[13px] font-medium tracking-[0.13px]" style={{ color: "var(--product-color-text-tertiary)" }}>
            特に良かった点を教えてください（複数選択可）
          </p>
        </div>

        <div className="flex w-full flex-col items-start gap-[var(--product-space-12)]">
          {rows.map((row) => (
            <div key={row.join()} className="flex w-full items-start gap-[var(--product-space-12)]">
              {row.map((tag) => (
                <TagChip key={tag} label={tag} selected={selectedTags.includes(tag)} onToggle={() => onToggleTag(tag)} />
              ))}
            </div>
          ))}
        </div>

        <div className="flex w-full flex-col items-start gap-[var(--product-space-8)]">
          <p className="text-xs font-medium tracking-[0.12px]" style={{ color: "var(--product-color-text-secondary)" }}>
            ひとことあれば（任意）
          </p>
          <textarea
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            placeholder="例：パンケーキがふわふわで感動しました"
            className="h-[88px] w-full resize-none rounded-[var(--product-radius-md)] border-solid p-[var(--product-space-16)] text-sm font-medium tracking-[0.14px] outline-none"
            style={{
              borderWidth: 1.5,
              borderColor: "var(--product-color-border-default)",
              backgroundColor: "var(--product-color-surface-white)",
              color: "var(--product-color-text-primary)",
            }}
          />
        </div>
      </div>

      <div className="min-h-px w-full flex-1" />

      <div className="flex w-full max-w-[342px] flex-col items-center gap-[var(--product-space-12)]">
        {error && (
          <p className="w-full text-center text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-status-warning)" }}>
            {error}
          </p>
        )}
        <LoopButton variant="primary" disabled={selectedTags.length === 0 || submitting} onClick={onSubmit}>
          {submitting ? "送信中…" : "回答する"}
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
