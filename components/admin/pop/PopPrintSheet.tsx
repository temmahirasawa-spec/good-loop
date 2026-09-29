import { PopCard, type PopCardContent } from "@/components/admin/pop/PopCard";

/**
 * A4 の名刺用紙（10面・91×55mm）に、同じ名刺を10枚並べる（2026-09-29、天真「おすすめでOK」）。
 * 市販の名刺用紙の配置：上下の余白 11mm・左右の余白 14mm・2列×5段・名刺どうしの間は 0。
 * Figma MTG「印刷の形 / A4 の名刺用紙（10面・91×55mm）」（1571:34660）を写したもの。
 *
 * 縦のデザイン（55×91mm）は、用紙の上では横に倒して並べる（切り離せば縦で置ける）。
 * `unit` は PopCard と同じ（Figma の 1px＝何か）。印刷は 0.25mm、画面の縮小表示は px を渡す。
 */
export function PopPrintSheet({ content, unit }: { content: PopCardContent; unit: string }) {
  const u = (n: number) => `calc(${n} * ${unit})`;
  const portrait = content.orientation === "portrait";
  // Figma の 1px＝0.25mm。A4 は 210×297mm＝840×1188
  return (
    <div
      style={{
        width: u(840),
        height: u(1188),
        boxSizing: "border-box",
        padding: `${u(44)} ${u(56)}`,
        display: "grid",
        gridTemplateColumns: `repeat(2, ${u(364)})`,
        gridTemplateRows: `repeat(5, ${u(220)})`,
        // design-qa-allow: 印刷する用紙そのものの色（紙の白）。画面の色ではない
        backgroundColor: "#ffffff",
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: u(364), height: u(220), position: "relative", overflow: "hidden" }}>
          {portrait ? (
            // 縦の名刺（220×364）を 90° 倒して、横の枠（364×220）にぴったり収める
            <div style={{ position: "absolute", left: 0, top: u(220), transform: "rotate(-90deg)", transformOrigin: "top left" }}>
              <PopCard content={content} unit={unit} />
            </div>
          ) : (
            <PopCard content={content} unit={unit} />
          )}
        </div>
      ))}
    </div>
  );
}
