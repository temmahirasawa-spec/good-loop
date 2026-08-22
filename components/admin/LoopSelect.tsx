"use client";

/**
 * Loop / Select — ブラウザ標準の `<select>` を LoopInput と同じ見た目に整えたもの。
 *
 * 2026-08-22、天真の依頼で新設（設定・アンケート項目の業態選択）。自前のドロップダウンを
 * 作らず標準の `<select>` を使うのは、
 *   ・スマホでは端末のホイールピッカーが出る（＝お客様が毎日使っているUI）
 *   ・キーボード操作・読み上げ・文字サイズの拡大が最初から効く
 * の2点のため。矢印だけは各OSの既定が不揃いなので、自前のSVGを重ねて揃えている。
 */
export function LoopSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-xl border bg-[var(--product-color-surface-white)] pl-4 pr-10 text-sm font-medium text-[color:var(--product-color-text-primary)] outline-none"
        style={{ borderWidth: 1, borderColor: "var(--product-color-border-default)" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
        <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
