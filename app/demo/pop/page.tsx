import type { Metadata } from "next";
import { CardGateProvider } from "@/components/admin/billing/CardGate";
import { PopStepEditor } from "@/components/admin/pop/PopStepEditor";
import { PopCard } from "@/components/admin/pop/PopCard";
import { PopPrintSheet } from "@/components/admin/pop/PopPrintSheet";
import { POP_DESIGNS, POP_ORIENTATIONS, isPopColor, isPopDesign, isPopOrientation, type PopSettings } from "@/lib/admin/pop";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * 卓上POP（名刺サイズ）の見え方を確かめるページ（2026-09-29）。
 *
 * **検証専用。DBには読み書きしない。ログインも要らない。** 管理画面の本物のページはログインが要るため、
 * 部品だけを見本の値で並べている。見本の店舗は「YORKYS BRUNCH」、二次元コードは見本の URL。
 *
 *   /demo/pop?step=1..4          案3 の各段（o=landscape|portrait・d=デザイン・c=色）
 *   /demo/pop?step=3&logo=none   お店のロゴが未登録
 *   /demo/pop?step=4&error=1     保存できなかった
 *   /demo/pop?paused=1           お休み中（見るだけ）
 *   /demo/pop?view=all           12種を並べる（c=色）
 *   /demo/pop?view=sheet         A4 の名刺用紙
 */
export const metadata: Metadata = {
  title: "卓上POP 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

type Search = { step?: string; o?: string; d?: string; c?: string; logo?: string; error?: string; paused?: string; view?: string; gr?: string };

export default async function DemoPopPage({ searchParams }: { searchParams: Search }) {
  const qrSvg = await generateQrSvg(`${PUBLIC_APP_URL}/r/demo-sannomiya`);
  const settings: PopSettings = {
    orientation: isPopOrientation(searchParams.o) ? searchParams.o : "landscape",
    design: isPopDesign(searchParams.d) ? searchParams.d : "simple",
    color: isPopColor(searchParams.c) ? searchParams.c : "restaurant",
    heading: "",
    note: "",
    qrSize: "lg",
    showStoreLogo: true,
    showBrandLogo: searchParams.gr !== "0",
  };
  const logoUrl = searchParams.logo === "none" ? null : "/demo/sample-store-logo.svg";
  const base = { storeName: "YORKYS BRUNCH", logoUrl, qrSvg };

  if (searchParams.view === "all") {
    return (
      <main className="flex min-h-dvh w-full flex-col gap-8 p-8" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
        {POP_ORIENTATIONS.map((o) => (
          <div key={o.code} className="flex flex-wrap items-start gap-6">
            {POP_DESIGNS.map((d) => (
              <figure key={d.code} className="flex flex-col items-center gap-2">
                <div className="shadow-md">
                  <PopCard content={{ ...settings, ...base, orientation: o.code, design: d.code }} unit="1px" />
                </div>
                <figcaption className="text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
                  {o.label} ・ {d.label}
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </main>
    );
  }

  if (searchParams.view === "sheet") {
    return (
      // 本物の印刷ページ（app/admin/pop/[storeId]）と同じ組み方。実寸（0.25mm）で並べる
      <main className="flex min-h-dvh flex-col items-center gap-6 bg-[color:var(--product-color-bg-secondary)] p-6 print:block print:bg-transparent print:p-0">
        <style>{"@page { size: A4; margin: 0; }"}</style>
        <div className="shadow-md print:shadow-none">
          <PopPrintSheet content={{ ...settings, ...base }} unit="0.25mm" />
        </div>
      </main>
    );
  }

  const paused = searchParams.paused === "1";
  const step = Math.min(4, Math.max(1, Number(searchParams.step) || (paused ? 2 : 1)));
  return (
    <CardGateProvider needsCard={false} paused={paused} quota={2}>
      <main className="flex min-h-dvh w-full flex-col items-start gap-4 px-4 pb-10 pt-6 md:px-8 md:pt-8" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
        <div className="flex w-full items-center justify-between rounded-2xl px-6 py-5" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
          <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            卓上POPを作る
          </p>
          <p className="text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
            検証用の見本（DB を使わない）
          </p>
        </div>
        <PopStepEditor
          storeId="demo"
          storeName={base.storeName}
          logoUrl={logoUrl}
          qrSvg={paused ? null : qrSvg}
          initial={settings}
          paused={paused}
          initialStep={step}
          initialError={searchParams.error === "1" ? "保存できませんでした。もう一度お試しください。" : null}
        />
      </main>
    </CardGateProvider>
  );
}
