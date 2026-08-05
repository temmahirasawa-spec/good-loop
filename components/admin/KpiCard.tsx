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
      className="flex flex-1 flex-col items-start gap-2 rounded-2xl p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <p className="text-[40px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {value}
        </p>
        <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          {unit}
        </p>
      </div>
      <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
        {prevLabel}
      </p>
      {note && (
        <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          {note}
        </p>
      )}
    </div>
  );
}
