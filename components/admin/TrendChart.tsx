/**
 * トレンドの折れ線グラフ（Figma node 48:1062の「chart」を、静的アセットではなく
 * 実データから生成するSVGとして実装した。はりぼてでも数値を差し替えられるように）。
 */
export function TrendChart({ values, labels, unit = "" }: { values: number[]; labels: string[]; unit?: string }) {
  const width = 1100;
  const height = 128;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height * 0.7 - height * 0.15;
    return { x, y, v };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="relative h-24 w-full md:h-32">
        <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" preserveAspectRatio="none">
          <path d={path} fill="none" stroke="var(--review-accent-primary)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{ left: `${(p.x / width) * 100}%`, top: `${(p.y / height) * 100}%`, transform: "translate(-50%, -50%)" }}
          >
            <span
              className="absolute -top-5 whitespace-nowrap font-medium text-xs"
              style={{ color: "var(--product-color-text-secondary)", fontFamily: "var(--font-barlow), sans-serif" }}
            >
              {p.v}
              {unit}
            </span>
            <span className="block size-2 rounded-full" style={{ backgroundColor: "var(--review-accent-primary)" }} />
          </div>
        ))}
      </div>
      <div className="flex w-full items-start justify-between text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
        {labels.map((label) => (
          <p key={label}>{label}</p>
        ))}
      </div>
    </div>
  );
}
