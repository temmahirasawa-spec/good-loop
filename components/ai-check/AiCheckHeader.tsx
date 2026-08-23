/**
 * ページ上部のワードマークとβバッジ。
 *
 * プロダクト名は **GOOD REVIEW**（2026-08-17 天真決定）。
 * ⚠ CSS変数の接頭辞（`--review-`）やドメイン等の内部の識別子は、この段階では改名していない。
 *   全体の改名は別タスク（docs/plans/ai-visibility-checker.md 9-9）。
 */
export function AiCheckHeader() {
  return (
    <header className="flex w-full items-center justify-between gap-[var(--product-space-12)] pt-[var(--product-space-20)]">
      <p
        className="whitespace-nowrap text-[19px] tracking-[0.38px]"
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontWeight: 600,
          color: "var(--product-color-text-primary)",
        }}
      >
        GOOD{" "}
        {/* マーカーで引いたような下線。塗りはトークンから取る */}
        <span
          className="px-[var(--product-space-2)]"
          style={{
            background:
              "linear-gradient(to top, var(--review-accent-light) 38%, transparent 38%)",
          }}
        >
          REVIEW
        </span>
      </p>

      <span
        className="whitespace-nowrap rounded-[var(--product-radius-full)] border border-solid px-[var(--product-space-12)] py-[var(--product-space-4)] text-[10px] tracking-[1.2px]"
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontWeight: 600,
          backgroundColor: "var(--product-color-surface-white)",
          borderColor: "var(--product-color-border-default)",
          color: "var(--product-color-text-secondary)",
        }}
      >
        AI VISIBILITY CHECKER β
      </span>
    </header>
  );
}
