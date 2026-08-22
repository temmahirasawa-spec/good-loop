"use client";

import { Header } from "../Header";
import { ProgressBar } from "../ProgressBar";
import { CheckRow } from "../CheckRow";
import { LoopButton } from "../Button";

/**
 * 04 / 改善アンケート（★1-3）（Figma node 1:306）
 * チェックを1つ選ぶまで「送信する」は非活性（2026-08-05 天真指示。01/02画面と同様のルール）
 *
 * チェック項目は店舗ごとに編集できる（launch-plan.md 決定②）ため、固定の定数ではなく
 * props（`items`）で受け取る。呼び出し元（app/r/[storeSlug]/page.tsx）が store_tags から解決する。
 */
export function ImproveSurvey({
  storeName,
  items,
  checked,
  onToggle,
  freeText,
  onFreeTextChange,
  submitting,
  error,
  onSubmit,
}: {
  storeName: string;
  items: string[];
  checked: string[];
  onToggle: (item: string) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
  submitting: boolean;
  error?: string;
  onSubmit: () => void;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col items-start px-[var(--product-space-24)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <ProgressBar step={1} />
      <div className="h-12 w-full shrink-0" />
      <Header storeName={storeName} />
      <div className="h-10 w-full shrink-0" />

      <div className="flex w-full max-w-[342px] flex-col items-center gap-[var(--product-space-8)] text-center">
        <p className="text-[17px] font-bold tracking-[0.17px]" style={{ color: "var(--product-color-text-primary)" }}>
          貴重なご意見をありがとうございます
        </p>
        <p className="text-[13px] font-medium tracking-[0.13px]" style={{ color: "var(--product-color-text-tertiary)" }}>
          いただいた内容は店舗の責任者が直接確認します
          <br />
          改善に活かさせてください
        </p>
      </div>
      <div className="h-4 w-full shrink-0" />

      <div className="flex w-full max-w-[342px] flex-col items-start gap-[var(--product-space-8)]">
        {items.map((item) => (
          <CheckRow key={item} label={item} checked={checked.includes(item)} onToggle={() => onToggle(item)} />
        ))}
      </div>
      <div className="h-6 w-full shrink-0" />

      <div className="flex w-full max-w-[342px] flex-col items-start gap-[var(--product-space-8)]">
        <p className="text-xs font-medium tracking-[0.12px]" style={{ color: "var(--product-color-text-secondary)" }}>
          詳しく教えていただけますか（任意）
        </p>
        <textarea
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder="例：注文から提供まで30分ほどかかりました"
          className="h-[88px] w-full resize-none rounded-[var(--product-radius-md)] border-solid p-[var(--product-space-16)] text-sm font-medium tracking-[0.14px] outline-none"
          style={{
            borderWidth: 1.5,
            borderColor: "var(--product-color-border-default)",
            backgroundColor: "var(--product-color-surface-white)",
            color: "var(--product-color-text-primary)",
          }}
        />
      </div>

      <div className="min-h-px w-full flex-1" />

      <div className="flex w-full max-w-[342px] flex-col items-center gap-[var(--product-space-12)]">
        {error && (
          <p className="w-full text-center text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-status-warning)" }}>
            {error}
          </p>
        )}
        <LoopButton variant="primary" size="lg" disabled={checked.length === 0 || submitting} onClick={onSubmit}>
          {submitting ? "送信中…" : "送信する"}
        </LoopButton>
        <p
          className="w-full text-center text-[11px] font-medium tracking-[0.22px]"
          style={{ color: "var(--product-color-text-tertiary)" }}
        >
          店舗スタッフには匿名で共有されます
        </p>
      </div>
    </div>
  );
}
