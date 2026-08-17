const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * AI視認性スコアの円グラフ。
 *
 * ⚠ SVGは属性に `var()` を書いても解決されない（CLAUDE.md 4章）。
 *   そのため色は **style 属性**（＝CSS）で指定している。`stroke="var(--...)"` とは書かない。
 */
export function ScoreRing({
  score,
  color,
  shown,
  reducedMotion,
}: {
  score: number;
  /** 進捗弧の色。CSS変数を参照する文字列を渡す */
  color: string;
  /** マウント後に true にすると弧が伸びる */
  shown: boolean;
  reducedMotion: boolean;
}) {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <svg viewBox="0 0 100 100" className="size-[86px] shrink-0" role="img" aria-label={`AI視認性スコア ${score} / 100`}>
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        strokeWidth={10}
        style={{ stroke: "var(--product-color-bg-tertiary)" }}
      />
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE.toFixed(1)}
        strokeDashoffset={shown ? offset.toFixed(1) : CIRCUMFERENCE.toFixed(1)}
        style={{
          stroke: color,
          transform: "rotate(-90deg)",
          transformOrigin: "50% 50%",
          transition: reducedMotion ? "none" : "stroke-dashoffset 1.1s cubic-bezier(0.3, 0.8, 0.3, 1)",
        }}
      />
    </svg>
  );
}
