"use client";

import { LoopButton } from "@/components/rating-flow/Button";
import Link from "next/link";

/**
 * 実際のQRコード（launch-plan.md D-7、2026-08-06実装）。
 * サーバー側で生成したSVG（`lib/qr-code.ts`）をそのまま描画する。読み取り信頼性のため
 * 常に黒/白（デザイントークンでは色付けしない）。
 */
function QrImage({ svg }: { svg: string }) {
  return (
    <div
      className="relative size-[120px] shrink-0 overflow-hidden rounded-lg [&>svg]:size-full"
      style={{ backgroundColor: "white", border: "1px solid var(--product-color-border-divider)" }}
      // eslint-disable-next-line react/no-danger -- lib/qr-code.tsがサーバー側で生成した固定フォーマットのSVGで、外部入力を含まない
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** SVG文字列をPNGに変換してダウンロードする（Canvas経由。印刷・貼り付けに使いやすい形式） */
function downloadQr(svg: string, slug: string) {
  const svgBlob = new Blob([svg], { type: "image/svg+xml" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.onload = () => {
    const size = 1024; // 印刷に耐える解像度
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // design-qa-allow: PNG化するQRコードの背景は読み取り信頼性のため常に白固定（QRのdark/lightと揃える）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);
    URL.revokeObjectURL(svgUrl);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${slug}-qr.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  image.src = svgUrl;
}

/** PC版（Figma node 56:957） */
export function QrCard({
  storeName,
  slug,
  qrSvg,
  reads,
  low,
}: {
  storeName: string;
  slug: string;
  qrSvg: string;
  reads: number;
  low?: boolean;
}) {
  return (
    <div
      className="hidden w-[371px] shrink-0 flex-col items-center gap-3 rounded-2xl p-6 md:flex"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <QrImage svg={qrSvg} />
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
        <LoopButton variant="outline" onClick={() => downloadQr(qrSvg, slug)}>
          画像をダウンロード
        </LoopButton>
      </div>
      {/* 2026-08-22、卓上POPの編集画面につないだ（それまでは押しても何も起きなかった） */}
      <Link href="/admin/settings/pop" className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
        印刷用POPを作る
      </Link>
    </div>
  );
}

/** SP版（Figma node 56:1303）— QRと情報を横並びに、操作はテキストリンクにする */
export function QrCardMobile({
  storeName,
  slug,
  qrSvg,
  reads,
  low,
}: {
  storeName: string;
  slug: string;
  qrSvg: string;
  reads: number;
  low?: boolean;
}) {
  return (
    <div
      className="flex w-full items-center gap-4 rounded-2xl p-4 md:hidden"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <QrImage svg={qrSvg} />
      <div className="flex flex-1 flex-col items-start gap-2">
        <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {storeName}
        </p>
        <p className="text-[11.5px] font-medium" style={{ color: low ? "var(--product-color-status-warning)" : "var(--product-color-text-secondary)" }}>
          読み取り {reads}回（直近7日）
        </p>
        {low && (
          <p className="text-[11px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            読み取りが少なくなっています
          </p>
        )}
        <div className="flex items-start gap-4 text-[12.5px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
          <button type="button" onClick={() => downloadQr(qrSvg, slug)}>
            ダウンロード
          </button>
          <Link href="/admin/settings/pop">印刷用POP</Link>
        </div>
      </div>
    </div>
  );
}
