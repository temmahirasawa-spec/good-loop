"use client";

/**
 * v4「文にする」で出る**灰色の1文**（docs/specs/survey-v4.md §6-2）。
 *
 * **本文欄の中身は書き換わらない。** タップして初めて本文になる。
 * これは arXiv 2404.00027v3 の「自動挿入より手動取り込みのほうがオーナーシップ（＝自分が書いたという
 * 感覚）の低下が小さい」に沿った形。v3 の「押すと全文が出てコピーする」はこの逆だった。
 *
 * AI人格の演出・吹き出し・「AIが考えています」の文言は**出さない**
 * （擬人化ではオーナーシップは回復しないことが実験で確認されている）。
 */

export function SuggestLine({
  text,
  onAdopt,
  onUndo,
  canUndo,
}: {
  text: string;
  onAdopt: () => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="review-rise flex w-full flex-col gap-[var(--product-space-8)]">
      <button
        type="button"
        onClick={onAdopt}
        className="flex w-full items-center rounded-[var(--product-radius-md)] border-[1.5px] border-dashed px-[var(--product-space-12)] py-[var(--product-space-12)] text-left transition-transform duration-100 active:scale-[0.99]"
        style={{
          minHeight: "var(--product-touch-min)",
          backgroundColor: "var(--product-color-bg-secondary)",
          borderColor: "var(--product-color-border-default)",
        }}
      >
        <span className="text-[15px] font-medium leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
          {text}
        </span>
      </button>
      {canUndo ? (
        <button
          type="button"
          onClick={onUndo}
          className="self-end px-[var(--product-space-8)] text-sm font-bold underline"
          style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
        >
          もどす
        </button>
      ) : (
        <p className="px-[var(--product-space-4)] text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          タップすると、この文が入力欄に入ります
        </p>
      )}
    </div>
  );
}
