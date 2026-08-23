/**
 * Loop / KPI Card（Figma node 79:1699 Size=L / 79:1706 Size=S）。
 *
 * 2026-08-23、Figmaコメント 1895819075「このカードコンポーネント読みにくすぎる。
 * ラインや色を使ってわかりやすく。数字のメリハリを意識」を受けて作り直した。
 *
 *   数字のメリハリ … 見出しは小さく淡く、数字は大きく濃く。単位は数字より一段小さい
 *   ライン        … 数字のかたまりと前期の比較を横線で分ける
 *   色            … 前期からの増減を色で示す（増＝業態色／減＝警告色／横ばい＝淡いグレー）
 *
 * 増減は「多いほど良い」指標を前提にしている（送客数・回答数・送客率）。
 * 「少ないほど良い」指標を足すときは、色の向きを反転する引数が要る。
 */

export type KpiDelta = { text: string; direction: "up" | "down" | "flat" };

/** 前期と比べた増減を、表示用の文字と向きにする */
export function toDelta(current: number | null, prev: number | null, unit: string): KpiDelta | undefined {
  if (current === null || prev === null) return undefined;
  const diff = current - prev;
  if (diff === 0) return { text: `前期と同じ`, direction: "flat" };
  return { text: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}${unit}`, direction: diff > 0 ? "up" : "down" };
}

const DELTA_COLOR: Record<KpiDelta["direction"], string> = {
  up: "var(--loop-accent-primary)",
  down: "var(--product-color-status-warning)",
  flat: "var(--product-color-text-tertiary)",
};
const DELTA_MARK: Record<KpiDelta["direction"], string> = { up: "▲", down: "▼", flat: "—" };

export function KpiCard({
  label,
  value,
  unit = "件",
  prevLabel,
  delta,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  prevLabel: string;
  delta?: KpiDelta;
  note?: string;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col items-start gap-3 rounded-2xl p-4 md:p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="whitespace-nowrap text-[11px] font-medium md:text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>

      <div className="flex items-baseline gap-1">
        <p className="text-[34px] font-bold leading-none tracking-[-0.5px] md:text-[44px]" style={{ color: "var(--product-color-text-primary)" }}>
          {value}
        </p>
        {/* 送客率のように単位が値に含まれる指標では unit="" を渡して単位を出さない */}
        {unit && (
          <p className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {unit}
          </p>
        )}
      </div>

      <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
        <p className="whitespace-nowrap text-[11px] font-medium md:text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
          {prevLabel}
        </p>
        {delta && (
          <p className="whitespace-nowrap text-[11px] font-bold md:text-xs" style={{ color: DELTA_COLOR[delta.direction] }}>
            {DELTA_MARK[delta.direction]} {delta.text}
          </p>
        )}
      </div>

      {note && (
        <p className="text-[10.5px] font-medium leading-relaxed md:text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
