/** Loop / KPI Card（Figma node 79:1699） */
export function KpiCard({
  label,
  value,
  unit = "件",
  prevLabel,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  prevLabel: string;
  note?: string;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col items-start gap-1 rounded-2xl p-4 md:gap-2 md:p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <p className="text-[28px] font-bold md:text-[40px]" style={{ color: "var(--product-color-text-primary)" }}>
          {value}
        </p>
        {/* 送客率のように単位が値に含まれる指標では unit="" を渡して単位を出さない（Figmaの Unit 非表示に対応） */}
        {unit && (
          <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {unit}
          </p>
        )}
      </div>
      <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
        {prevLabel}
      </p>
      {note && (
        <p className="text-[10.5px] font-medium md:text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
