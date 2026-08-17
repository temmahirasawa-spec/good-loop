/**
 * AI視認性チェッカー専用のアイコン。
 *
 * ⚠ SVGは属性に `var()` を書いても解決されない（CLAUDE.md 4章）。
 *   色は `stroke="currentColor"` にして、呼び出し側が `style={{ color }}` で渡すか、
 *   親から継承させること。
 */
export function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}
