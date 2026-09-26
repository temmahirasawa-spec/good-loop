"use client";

/**
 * v5「続きを聞く」でAIが出す**問い**（docs/specs/survey-v5.md §3）。
 *
 * 頭に小さく「AI」と付ける（2026-09-26 天真の決定）。AIが何をしたか＝問いを出しただけ、が本人に分かるようにする。
 * **問いは本文欄に入らない。** 答えを書くのは本人。押すと本文欄にカーソルが戻るだけ。
 *
 * AI人格の演出・「考えています」の文言は出さない（v4 と同じ。擬人化では所有感は戻らない）。
 */
export function AskChip({ question, onFocusInput }: { question: string; onFocusInput: () => void }) {
  return (
    <div role="status" aria-live="polite" className="w-full">
      <button
        key={question}
        type="button"
        onClick={onFocusInput}
        className="review-rise flex w-full items-start gap-[var(--product-space-8)] rounded-[var(--product-radius-md)] px-[var(--product-space-12)] py-[var(--product-space-8)] text-left"
        style={{ minHeight: "var(--product-touch-min)", backgroundColor: "var(--review-accent-wash)" }}
      >
        <span
          className="mt-[3px] shrink-0 rounded-[var(--product-radius-sm)] px-[var(--product-space-8)] text-[11px] font-bold leading-[1.7] tracking-[0.5px]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          AI
        </span>
        <span className="text-[15px] font-bold leading-[1.6]" style={{ color: "var(--product-color-text-primary)" }}>
          {question}
        </span>
      </button>
    </div>
  );
}
