/* eslint-disable @next/next/no-img-element -- 印刷する名刺の中の画像。next/image の最適化（幅の指定と遅延読み込み）は印刷の直前に画像が欠ける原因になるため使わない */
import type { CSSProperties, ReactNode } from "react";
import { printableText, qrScaleOf, type PopDesign, type PopOrientation, type PopSettings } from "@/lib/admin/pop";

/**
 * 卓上POP（名刺サイズ 91×55mm）の1枚。Figma Components「08 卓上POP / 名刺サイズ」（1566:25902）の12種を写したもの。
 *
 * **寸法は Figma の数字のまま**書いてある（Figma は 1mm＝4px）。`unit` に「Figma の 1px が何にあたるか」を渡す：
 * 印刷は `0.25mm`（＝実寸）、画面のプレビューは `1px` など。すべて calc(数字 × 単位) で描くので、
 * 同じ部品が画面と紙で同じ見た目になる。
 *
 * 色は `data-review-theme`（色テーマの9色）で切り替える。塗りは Figma と同じく industry/accent/* にあたる
 * `--review-accent-*` を使う（app/design-tokens.css）。二次元コードの面だけは読み取りのため常に白。
 */

export type PopCardContent = PopSettings & {
  storeName: string;
  /** 設定＞ブランドとテーマで登録したお店のロゴ。未登録は null */
  logoUrl: string | null;
  /** サーバーで作った二次元コードの SVG。カードを登録する前・お休みのあいだは null（鍵の絵を出す） */
  qrSvg: string | null;
};

const W = { landscape: 364, portrait: 220 } as const;
const H = { landscape: 220, portrait: 364 } as const;

/** 各デザインの二次元コードの基準の大きさ（＝大）。Figma の値 */
const QR_BASE: Record<PopOrientation, Record<PopDesign, number>> = {
  landscape: { simple: 112, simple_frame: 104, illust_bubble: 100, illust_phone: 96, solid: 100, solid_band: 96 },
  portrait: { simple: 124, simple_frame: 112, illust_bubble: 108, illust_phone: 104, solid: 112, solid_band: 116 },
};

const BRAND_LOGO_RATIO = 631.2 / 66.7;

const C = {
  accent: "var(--review-accent-primary)",
  light: "var(--review-accent-light)",
  wash: "var(--review-accent-wash)",
  onAccent: "var(--review-accent-on-primary)",
  white: "var(--product-color-surface-white)",
  text: "var(--product-color-text-primary)",
  sub: "var(--product-color-text-secondary)",
  divider: "var(--product-color-border-divider)",
  star: "var(--product-color-secondary-primary)",
  lockBg: "var(--product-color-bg-tertiary)",
  lockInk: "var(--product-color-text-tertiary)",
};

export function PopCard({ content, unit }: { content: PopCardContent; unit: string }) {
  const u = (n: number) => `calc(${n} * ${unit})`;
  const o = content.orientation;
  const d = content.design;
  const text = printableText(content);
  const qr = Math.round(QR_BASE[o][d] * qrScaleOf(content.qrSize));
  const solid = d === "solid";
  const land = o === "landscape";

  const heading = (size: number, color: string, align: "left" | "center" = land ? "left" : "center") => (
    <p style={{ margin: 0, width: "100%", fontSize: u(size), fontWeight: 700, lineHeight: 1.4, color, textAlign: align, overflowWrap: "anywhere" }}>{text.heading}</p>
  );
  const note = (color: string, opts?: { size?: number; bold?: boolean; align?: "left" | "center" }) => (
    <p
      style={{
        margin: 0,
        width: "100%",
        fontSize: u(opts?.size ?? 10),
        fontWeight: opts?.bold ? 700 : 400,
        lineHeight: 1.4,
        color,
        textAlign: opts?.align ?? (land ? "left" : "center"),
        overflowWrap: "anywhere",
      }}
    >
      {text.note}
    </p>
  );
  const store = (nameColor: string, onColor = false) => (
    <StoreMark content={content} u={u} nameColor={nameColor} onColor={onColor} center={!land} />
  );
  const code = (size: number, mount = false) => <QrMark svg={content.qrSvg} size={size} u={u} mount={mount} />;

  const col = (children: ReactNode, style?: CSSProperties) => (
    <div style={{ display: "flex", flexDirection: "column", gap: u(8), minWidth: 0, flex: land ? "1 1 0" : undefined, width: land ? undefined : "100%", alignItems: land ? "flex-start" : "center", ...style }}>
      {children}
    </div>
  );

  let body: ReactNode;
  let background = C.white;
  let padding = land ? "20 20 32 20" : "24 16 32 16";
  let gap = land ? 16 : 12;
  let direction: "row" | "column" = land ? "row" : "column";
  let extra: ReactNode = null;

  switch (d) {
    case "simple":
      body = land ? (
        <>
          {col(<>{store(C.sub)}{heading(17, C.text)}{note(C.sub)}</>)}
          {code(qr)}
        </>
      ) : (
        <>
          {store(C.sub)}
          {heading(15, C.text)}
          {code(qr)}
          {note(C.sub)}
        </>
      );
      break;
    case "simple_frame":
      padding = "12 12 24 12";
      gap = 0;
      body = (
        <div
          style={{
            flex: "1 1 0",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: land ? "row" : "column",
            alignItems: "center",
            justifyContent: "center",
            gap: u(land ? 16 : 12),
            padding: land ? u(16) : `${u(20)} ${u(12)} ${u(16)}`,
            border: `${u(2)} solid ${C.accent}`,
            borderRadius: u(8),
          }}
        >
          {land ? (
            <>
              {code(qr)}
              {col(<>{heading(16, C.accent)}<Rule u={u} />{note(C.sub)}{store(C.text)}</>)}
            </>
          ) : (
            <>
              {store(C.text)}
              {heading(15, C.accent)}
              <Rule u={u} />
              {code(qr)}
              {note(C.sub)}
            </>
          )}
        </div>
      );
      break;
    case "illust_bubble":
      background = C.wash;
      body = land ? (
        <>
          {col(<>{store(C.sub)}<Bubble u={u} size={14} land>{text.heading}</Bubble>{note(C.sub)}</>)}
          {code(qr, true)}
        </>
      ) : (
        <>
          {store(C.sub)}
          <Bubble u={u} size={13}>{text.heading}</Bubble>
          {code(qr, true)}
          {note(C.sub)}
        </>
      );
      extra = land ? (
        <>
          <Star u={u} x={150} y={14} size={14} />
          <Star u={u} x={172} y={8} size={10} />
          <Sparkle u={u} x={196} y={18} size={10} />
        </>
      ) : (
        <>
          <Star u={u} x={18} y={18} size={14} />
          <Star u={u} x={38} y={10} size={10} />
          <Sparkle u={u} x={186} y={22} size={12} />
        </>
      );
      break;
    case "illust_phone":
      gap = land ? 8 : 12;
      body = land ? (
        <>
          {col(<>{store(C.sub)}{heading(14, C.text)}{note(C.sub)}</>)}
          <Phone u={u} />
          {code(qr)}
        </>
      ) : (
        <>
          {store(C.sub)}
          {heading(15, C.text)}
          <div style={{ display: "flex", alignItems: "center", gap: u(4) }}>
            {code(qr)}
            <Phone u={u} />
          </div>
          {note(C.sub)}
        </>
      );
      break;
    case "solid":
      background = C.accent;
      body = land ? (
        <>
          {col(<>{store(C.onAccent, true)}{heading(16, C.onAccent)}{note(C.onAccent)}</>)}
          {code(qr, true)}
        </>
      ) : (
        <>
          {store(C.onAccent, true)}
          {heading(16, C.onAccent)}
          {code(qr, true)}
          {note(C.onAccent)}
        </>
      );
      break;
    case "solid_band":
      padding = "0 0 0 0";
      gap = 0;
      direction = "column";
      body = (
        <>
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: land ? "flex-start" : "center",
              gap: u(land ? 4 : 8),
              padding: land ? `${u(16)} ${u(20)} ${u(12)}` : `${u(24)} ${u(16)} ${u(20)}`,
              backgroundColor: C.accent,
            }}
          >
            {store(C.onAccent, true)}
            {heading(land ? 17 : 16, C.onAccent)}
          </div>
          <div
            style={{
              flex: "1 1 0",
              width: "100%",
              display: "flex",
              flexDirection: land ? "row" : "column",
              alignItems: "center",
              justifyContent: "center",
              gap: u(land ? 16 : 8),
              padding: land ? `${u(8)} ${u(20)} ${u(24)}` : `${u(16)} ${u(16)} ${u(32)}`,
            }}
          >
            {land ? (
              <>
                {note(C.accent, { size: 11, bold: true })}
                {code(qr)}
              </>
            ) : (
              <>
                {code(qr)}
                {note(C.accent, { size: 11, bold: true })}
              </>
            )}
          </div>
        </>
      );
      break;
  }

  const [pt, pr, pb, pl] = padding.split(" ").map(Number);
  return (
    <div
      data-review-theme={content.color}
      style={{
        position: "relative",
        width: u(W[o]),
        height: u(H[o]),
        overflow: "hidden",
        display: "flex",
        flexDirection: direction,
        alignItems: "center",
        justifyContent: "center",
        gap: u(gap),
        padding: `${u(pt)} ${u(pr)} ${u(pb)} ${u(pl)}`,
        backgroundColor: background,
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {extra}
      {body}
      {content.showBrandLogo && (
        <img
          src={solid ? "/brand/good-review-on-color.svg" : "/brand/good-review.svg"}
          alt="GOOD REVIEW"
          style={{
            position: "absolute",
            left: "50%",
            bottom: u(8),
            transform: "translateX(-50%)",
            width: u(64),
            height: u(64 / BRAND_LOGO_RATIO),
          }}
        />
      )}
    </div>
  );
}

/** お店のロゴ（登録済みでオンのとき）か、店名の文字 */
function StoreMark({
  content,
  u,
  nameColor,
  onColor,
  center,
}: {
  content: PopCardContent;
  u: (n: number) => string;
  nameColor: string;
  onColor: boolean;
  center: boolean;
}) {
  if (content.showStoreLogo && content.logoUrl) {
    return (
      <img
        src={content.logoUrl}
        alt={content.storeName}
        style={{
          height: u(20),
          maxWidth: u(96),
          objectFit: "contain",
          alignSelf: center ? "center" : "flex-start",
          // ベタ塗りの上では、ロゴの形がつぶれないよう白い台に載せる（Figma のお店のロゴは白の丸）
          ...(onColor ? { backgroundColor: C.white, borderRadius: u(4), padding: u(2) } : null),
        }}
      />
    );
  }
  return (
    <p style={{ margin: 0, fontSize: u(9), fontWeight: 700, lineHeight: 1.4, color: nameColor, letterSpacing: "0.02em", textAlign: center ? "center" : "left" }}>
      {content.storeName}
    </p>
  );
}

/** 二次元コード。mount は白い台紙に載せる形（イラスト・吹き出し／ベタ塗り） */
function QrMark({ svg, size, u, mount }: { svg: string | null; size: number; u: (n: number) => string; mount: boolean }) {
  const inner = svg ? (
    <div
      style={{
        width: u(size),
        height: u(size),
        flexShrink: 0,
        overflow: "hidden",
        borderRadius: u(size / 15),
        // design-qa-allow: 二次元コードの面は読み取りのため常に白（業態の色では塗らない）
        backgroundColor: "#ffffff",
        border: `${u(1)} solid ${C.divider}`,
        boxSizing: "border-box",
      }}
      className="[&>svg]:block [&>svg]:size-full"
      // eslint-disable-next-line react/no-danger -- lib/qr-code.ts がサーバーで作った固定の形の SVG。外からの入力を含まない
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  ) : (
    <div
      role="img"
      aria-label="カードを登録すると表示されます"
      style={{ width: u(size), height: u(size), flexShrink: 0, display: "grid", placeItems: "center", borderRadius: u(size / 15), backgroundColor: C.lockBg, color: C.lockInk }}
    >
      <svg viewBox="0 0 28 28" fill="none" aria-hidden style={{ width: u(size / 4), height: u(size / 4) }}>
        <path d="M9 13V9a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="5" y="12" width="18" height="13" rx="3" fill="currentColor" />
      </svg>
    </div>
  );
  if (!mount) return inner;
  return (
    <div style={{ padding: u(8), borderRadius: u(10), backgroundColor: C.white, flexShrink: 0 }}>{inner}</div>
  );
}

function Rule({ u }: { u: (n: number) => string }) {
  return <div style={{ width: u(24), height: u(2), backgroundColor: C.accent, flexShrink: 0 }} />;
}

/** 吹き出し（イラスト・吹き出し）。横はしっぽが左寄り、縦は中央 */
function Bubble({ u, size, land = false, children }: { u: (n: number) => string; size: number; land?: boolean; children: ReactNode }) {
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: land ? "flex-start" : "center" }}>
      <div style={{ width: "100%", padding: `${u(12)} ${u(16)}`, borderRadius: u(16), backgroundColor: C.white, boxSizing: "border-box" }}>
        <p style={{ margin: 0, fontSize: u(size), fontWeight: 700, lineHeight: 1.4, color: C.text, textAlign: "center", overflowWrap: "anywhere" }}>{children}</p>
      </div>
      <svg viewBox="0 0 16 12" aria-hidden style={{ width: u(16), height: u(12), marginLeft: land ? u(20) : undefined, color: C.white, display: "block" }}>
        <path d="M0 0h16L4 12z" fill="currentColor" />
      </svg>
    </div>
  );
}

function Star({ u, x, y, size }: { u: (n: number) => string; x: number; y: number; size: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", left: u(x), top: u(y), width: u(size), height: u(size), color: C.star }}>
      <path d="M12 1.5l3.1 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.3l-6.4 3.6 1.5-7.1-5.4-4.9 7.2-.8z" fill="currentColor" />
    </svg>
  );
}

function Sparkle({ u, x, y, size }: { u: (n: number) => string; x: number; y: number; size: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden style={{ position: "absolute", left: u(x), top: u(y), width: u(size), height: u(size), color: C.light }}>
      <path d="M12 0c.9 6.6 5.4 11.1 12 12-6.6.9-11.1 5.4-12 12-.9-6.6-5.4-11.1-12-12C6.6 11.1 11.1 6.6 12 0z" fill="currentColor" />
    </svg>
  );
}

/** スマホで読み取るイラスト（イラスト・スマホ）。Figma の 51×58 の絵を写したもの */
function Phone({ u }: { u: (n: number) => string }) {
  return (
    <svg viewBox="0 0 51 58" aria-hidden style={{ width: u(51), height: u(58), flexShrink: 0 }}>
      <rect x="1" y="6" width="25" height="46" rx="5.6" style={{ fill: C.white, stroke: C.accent }} strokeWidth="2" />
      <rect x="4" y="10" width="19" height="32" rx="2.4" style={{ fill: C.wash }} />
      {[6, 11, 17].map((cx) => (
        <circle key={cx} cx={cx + 2.5} cy="26.5" r="2" style={{ fill: C.star }} />
      ))}
      <path d="M33 25c4-1 8-5 9-11m0 0l-4 2m4-2l2 4" style={{ stroke: C.accent }} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
