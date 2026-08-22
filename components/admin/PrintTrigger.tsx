"use client";

import { LoopButton } from "@/components/rating-flow/Button";

/**
 * 卓上POPの印刷ボタン（印刷時は紙に出さない）。
 * ブラウザの印刷ダイアログで「PDFとして保存」を選べば、そのままPDFになる。
 */
export function PrintTrigger() {
  return (
    <div className="flex w-[240px] flex-col items-center gap-2 print:hidden">
      <LoopButton variant="primary" onClick={() => window.print()}>
        印刷する
      </LoopButton>
      <p className="text-center text-[11.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
        印刷ダイアログで「PDFとして保存」を選ぶと、PDFになります
      </p>
    </div>
  );
}
