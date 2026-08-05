import { LoopButton } from "@/components/rating-flow/Button";

/** Loop / QR Placeholder（Figma node 55:931）— ダミー表示。実装ではURLから動的生成する */
function QrPlaceholder() {
  const dots = [
    [47, 13], [63, 21], [41, 31], [57, 39], [75, 31], [91, 43], [47, 51], [29, 57],
    [65, 57], [83, 65], [45, 71], [59, 79], [75, 91], [93, 83], [43, 93], [59, 63], [91, 59], [103, 71],
  ];
  const finders: [number, number][] = [
    [9, 9], [85, 9], [9, 85],
  ];
  return (
    <div className="relative size-[120px] shrink-0 rounded-lg" style={{ backgroundColor: "white", border: "1px solid var(--product-color-border-divider)" }}>
      {finders.map(([x, y]) => (
        <div key={`${x}-${y}`}>
          <div className="absolute size-6" style={{ left: x, top: y, backgroundColor: "var(--product-color-text-primary)" }} />
          <div className="absolute size-4" style={{ left: x + 4, top: y + 4, backgroundColor: "white" }} />
          <div className="absolute size-2" style={{ left: x + 8, top: y + 8, backgroundColor: "var(--product-color-text-primary)" }} />
        </div>
      ))}
      {dots.map(([x, y]) => (
        <div key={`${x}-${y}`} className="absolute size-1.5" style={{ left: x, top: y, backgroundColor: "var(--product-color-text-primary)" }} />
      ))}
    </div>
  );
}

export function QrCard({
  storeName,
  reads,
  low,
}: {
  storeName: string;
  reads: number;
  low?: boolean;
}) {
  return (
    <div
      className="flex w-[371px] shrink-0 flex-col items-center gap-3 rounded-2xl p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <QrPlaceholder />
      <p className="whitespace-nowrap text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {storeName}
      </p>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <p className="text-xs font-medium" style={{ color: low ? "var(--product-color-status-warning)" : "var(--product-color-text-secondary)" }}>
          読み取り {reads}回
        </p>
        <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          （直近7日）
        </p>
      </div>
      {low && (
        <div className="flex items-start rounded-full px-3 py-1" style={{ backgroundColor: "var(--product-color-status-warning-wash)" }}>
          <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            読み取りが少なくなっています。設置場所をご確認ください
          </p>
        </div>
      )}
      <div className="w-full">
        <LoopButton variant="primary">画像をダウンロード</LoopButton>
      </div>
      <p className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
        印刷用PDFを開く
      </p>
    </div>
  );
}
