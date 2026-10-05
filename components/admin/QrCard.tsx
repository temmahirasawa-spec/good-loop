"use client";

import { ReviewButton } from "@/components/rating-flow/Button";
import { useRouter } from "next/navigation";
import { useCardGate } from "@/components/admin/billing/CardGate";

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

/**
 * カードを登録するまで二次元コードを出さない（無料体験 A案。docs/specs/billing.md §3-2）。
 * 鍵の絵だけを置き、押された操作はカードの関門（モーダル）へつなぐ。サーバーも SVG を渡してこない。
 */
function LockedQr() {
  return (
    <div
      className="grid size-[120px] shrink-0 place-items-center rounded-xl"
      style={{ backgroundColor: "var(--product-color-bg-tertiary)", color: "var(--product-color-text-tertiary)" }}
      aria-label="カードを登録すると表示されます"
      role="img"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M9 13V9a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="5" y="12" width="18" height="13" rx="3" fill="currentColor" />
      </svg>
    </div>
  );
}

/** SVG文字列をPNGに変換してダウンロードする（Canvas経由。印刷・貼り付けに使いやすい形式） */
export function downloadQr(svg: string, slug: string) {
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
}: {
  storeName: string;
  slug: string;
  /** カードを登録する前・お休みのあいだは null（サーバーが渡さない） */
  qrSvg: string | null;
}) {
  const gate = useCardGate();
  const router = useRouter();
  return (
    <div
      className="hidden w-[371px] shrink-0 flex-col items-center gap-3 rounded-2xl p-6 md:flex"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      {qrSvg ? <QrImage svg={qrSvg} /> : <LockedQr />}
      <p className="whitespace-nowrap text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {storeName}
      </p>
      <div className="w-full">
        <ReviewButton variant="outline" onClick={() => (qrSvg ? downloadQr(qrSvg, slug) : gate.requireCard())}>
          画像をダウンロード
        </ReviewButton>
      </div>
      {/* 2026-08-22、卓上POPの編集画面につないだ（それまでは押しても何も起きなかった） */}
      <button
        type="button"
        onClick={() => gate.requireCard(() => router.push("/admin/settings/pop"))}
        className="whitespace-nowrap text-[12.5px] font-medium"
        style={{ color: "var(--review-accent-primary)" }}
      >
        印刷用POPを作る
      </button>
    </div>
  );
}

/** SP版（Figma node 56:1303）— QRと情報を横並びに、操作はテキストリンクにする */
export function QrCardMobile({
  storeName,
  slug,
  qrSvg,
}: {
  storeName: string;
  slug: string;
  /** カードを登録する前・お休みのあいだは null（サーバーが渡さない） */
  qrSvg: string | null;
}) {
  const gate = useCardGate();
  const router = useRouter();
  return (
    <div
      className="flex w-full items-center gap-4 rounded-2xl p-4 md:hidden"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      {qrSvg ? <QrImage svg={qrSvg} /> : <LockedQr />}
      <div className="flex flex-1 flex-col items-start gap-2">
        <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {storeName}
        </p>
        <div className="flex items-start gap-4 text-[12.5px] font-medium" style={{ color: "var(--review-accent-primary)" }}>
          <button type="button" onClick={() => (qrSvg ? downloadQr(qrSvg, slug) : gate.requireCard())}>
            ダウンロード
          </button>
          <button type="button" onClick={() => gate.requireCard(() => router.push("/admin/settings/pop"))}>
            印刷用POP
          </button>
        </div>
      </div>
    </div>
  );
}
