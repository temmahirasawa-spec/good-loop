import { POP_QR_SIZES, presetOf } from "@/lib/admin/pop";

/**
 * 卓上POPの中身（Figma `Review / POP A・B・C`）。A6（105×148mm）。
 *
 * 編集画面のプレビューと、印刷ページ（/admin/pop/[storeId]）の両方で同じものを使う。
 * **プレビューと印刷結果が食い違わないように、必ずこの1つから描く。**
 *
 * 寸法はmmで指定する（印刷がmm、画面のプレビューはCSSがmmをそのまま扱えるため）。
 */

export type PopContent = {
  storeName: string;
  preset: string;
  heading: string;
  note: string;
  qrSize: string;
  /** サーバー生成のQRコード（SVG文字列） */
  qrSvg: string;
};

export function PopSheet({ content }: { content: PopContent }) {
  const preset = presetOf(content.preset);
  const qrMm = (POP_QR_SIZES.find((s) => s.code === content.qrSize) ?? POP_QR_SIZES[2]).mm;
  const lines = content.note.split("\n").filter((l) => l.trim() !== "");

  const qr = (
    <div
      className="shrink-0"
      style={{ width: `${qrMm}mm`, height: `${qrMm}mm` }}
      // QRはサーバーで生成した本物のSVG（lib/qr-code.ts）
      dangerouslySetInnerHTML={{ __html: content.qrSvg }}
    />
  );

  // 案B だけ「ことばが主役」なので左ぞろえ、ほかは中央ぞろえ
  const centered = preset.code !== "b";

  return (
    <div
      className="flex flex-col bg-white"
      style={{
        width: "105mm",
        height: "148mm",
        padding: "10mm 8mm",
        gap: "5mm",
        alignItems: centered ? "center" : "flex-start",
        justifyContent: preset.code === "c" ? "center" : "flex-start",
        color: "var(--product-color-text-primary)",
      }}
    >
      <p style={{ fontSize: "3.2mm", color: "var(--product-color-text-secondary)" }}>{content.storeName}</p>
      <p
        className="font-bold"
        style={{ fontSize: preset.code === "c" ? "5mm" : "6.4mm", lineHeight: 1.4, textAlign: centered ? "center" : "left" }}
      >
        {content.heading}
      </p>
      {qr}
      {lines.length > 0 && (
        <div className="flex flex-col" style={{ gap: "1.5mm", alignItems: centered ? "center" : "flex-start" }}>
          {lines.map((line) => (
            <p
              key={line}
              style={{ fontSize: "3.2mm", lineHeight: 1.6, color: "var(--product-color-text-secondary)", textAlign: centered ? "center" : "left" }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
