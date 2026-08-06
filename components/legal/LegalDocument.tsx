/**
 * 利用規約・プライバシーポリシー共通のレイアウト・タイポグラフィ。
 * docs/legal/{terms,privacy}.md の下書き（天真確認・コード化承認済み 2026-08-06）を実装したもの。
 */

export function LegalDocument({
  title,
  enactedOn,
  children,
}: {
  title: string;
  enactedOn: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-8 px-6 py-16 md:px-0">
      <div className="flex flex-col items-start gap-2">
        <h1 className="text-2xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </h1>
        <p className="text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          制定日：{enactedOn}
        </p>
      </div>
      <div className="flex w-full flex-col items-start gap-8">{children}</div>
    </main>
  );
}

export function LegalNotice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full flex-col items-start gap-1 rounded-xl p-4 text-[13px] font-medium"
      style={{ backgroundColor: "var(--product-color-status-warning-wash)", color: "var(--product-color-status-warning)" }}
    >
      {children}
    </div>
  );
}

export function LegalLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="w-full text-[14px] leading-[1.9]" style={{ color: "var(--product-color-text-secondary)" }}>
      {children}
    </p>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col items-start gap-3">
      <h2 className="text-[16px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {title}
      </h2>
      <div className="flex w-full flex-col items-start gap-3 text-[14px] leading-[1.9]" style={{ color: "var(--product-color-text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

export function LegalOrderedList({ children }: { children: React.ReactNode }) {
  return <ol className="flex w-full list-decimal flex-col items-start gap-1.5 pl-5">{children}</ol>;
}

export function LegalNestedList({ children }: { children: React.ReactNode }) {
  return <ol className="flex w-full list-[lower-roman] flex-col items-start gap-1 pl-5 text-[13.5px]">{children}</ol>;
}

export function LegalFooterInfo({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex w-full flex-col items-start gap-1 border-t pt-6 text-[13.5px] leading-[1.9]"
      style={{ borderColor: "var(--product-color-border-divider)", color: "var(--product-color-text-secondary)" }}
    >
      {children}
    </div>
  );
}

export function LegalTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[13px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--product-color-border-divider)" }}>
            {headers.map((h) => (
              <th key={h} className="py-2 pr-4 font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--product-color-border-divider)" }}>
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4" style={{ color: "var(--product-color-text-secondary)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
