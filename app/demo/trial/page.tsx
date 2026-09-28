import type { Metadata } from "next";
import { KpiCard } from "@/components/admin/KpiCard";
import { CardGateProvider, GateSummary } from "@/components/admin/billing/CardGate";
import { TrialBand, type TrialBandProps } from "@/components/admin/billing/TrialBand";
import { TrialStartedModal } from "@/components/admin/billing/TrialStartedModal";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { DemoOpenGate } from "./DemoOpenGate";

/**
 * 無料体験（A案）の部品の見え方を確かめるページ（2026-09-29）。
 *
 * **検証専用。DBには読み書きしない。ログインも要らない。** 管理画面の本物のページはログインが要り、
 * 検証のために契約先やアカウントを作らずに済ませるため、部品だけを見本の値で並べている。
 * 見本の値：2店舗・9月28日にカードを登録・10月12日まで無料。
 *
 *   /demo/trial?view=top        体験中のトップ（残り9日）
 *   /demo/trial?view=top3       残り3日（警告の色）
 *   /demo/trial?view=cancel     解約の予約中
 *   /demo/trial?view=paused     お休み中
 *   /demo/trial?view=gate       カードの関門（モーダル）
 *   /demo/trial?view=paid       以前に体験済み（有料で始める確認）
 *   /demo/trial?view=started    登録の直後（印刷して置く案内）
 *   /demo/trial?view=onboarding オンボーディング 7（カードの関門）
 */
export const metadata: Metadata = {
  title: "無料体験 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

const NUMBERS = { top: [52, 34, 21, 13], top3: [118, 79, 47, 32] } as const;

export default async function DemoTrialPage({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams.view ?? "top";
  const bands: Record<string, TrialBandProps> = {
    top: { kind: "trial", daysLeft: 9, endLabel: "10月12日" },
    top3: { kind: "trial", daysLeft: 3, endLabel: "10月12日" },
    cancel: { kind: "cancel", cancelLabel: "10月12日", daysLeft: 9 },
    paused: { kind: "paused" },
  };
  const n = view === "top3" ? NUMBERS.top3 : NUMBERS.top;

  if (view === "onboarding") {
    return (
      <CardGateProvider needsCard paused={false} quota={2}>
        <main className="flex min-h-dvh w-full items-start justify-center md:items-center" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
          <div className="flex w-full flex-col items-start gap-6 px-6 pb-40 pt-8 md:w-[640px] md:rounded-2xl md:p-12" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
            <p className="text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
              7 / 8
            </p>
            <div className="flex w-full flex-col items-start gap-4">
              <h1 className="text-[22px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                カードを登録して、無料体験を始める
              </h1>
              <p className="text-[13.5px] font-medium leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
                二次元コードの発行と店舗の追加は、お支払いのカードを登録してからお使いいただけます。14日間の無料体験は、登録した日から始まります。
              </p>
              <GateSummary quota={2} />
            </div>
          </div>
        </main>
      </CardGateProvider>
    );
  }

  const stores =
    view === "started"
      ? await Promise.all(
          [
            { id: "demo-1", name: "三宮本店", slug: "demo-sannomiya" },
            { id: "demo-2", name: "梅田うめきた店", slug: "demo-umeda" },
          ].map(async (s) => ({ ...s, qrSvg: await generateQrSvg(`${PUBLIC_APP_URL}/r/${s.slug}`) })),
        )
      : [];

  const paused = view === "paused";
  return (
    <CardGateProvider needsCard={view === "gate" || view === "paid" || paused} paused={paused} quota={2}>
      <main className="flex min-h-dvh w-full flex-col items-start gap-4 px-4 pb-8 pt-6 md:gap-6 md:px-8 md:pt-8" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
        <div className="flex w-full items-center justify-between rounded-2xl px-6 py-5" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
          <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            トップ
          </p>
          <p className="text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
            検証用の見本（DB を使わない）
          </p>
        </div>
        {bands[view] && <TrialBand {...bands[view]} />}
        {view !== "paused" && (
          <div className="grid w-full grid-cols-2 gap-2 md:flex md:gap-4">
            <KpiCard label="読み取られた数" value={String(n[0])} unit="回" prevLabel="9月28日から" wrapLabel />
            <KpiCard label="回答の数" value={String(n[1])} prevLabel="9月28日から" wrapLabel />
            <KpiCard label="Googleの投稿画面を開いた数" value={String(n[2])} unit="回" prevLabel="9月28日から" note="投稿画面を開いた数です。実際に投稿された数ではありません" wrapLabel />
            <KpiCard label="お店にだけ届いた声" value={String(n[3])} prevLabel="9月28日から" wrapLabel />
          </div>
        )}
        {(view === "gate" || view === "paid") && <DemoOpenGate paid={view === "paid"} />}
        {view === "started" && <TrialStartedModal stores={stores} daysLeft={14} endLabel="10月12日" />}
      </main>
    </CardGateProvider>
  );
}
