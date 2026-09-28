import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { KpiCard, toDelta } from "@/components/admin/KpiCard";
import { PeriodSegment } from "@/components/admin/PeriodSegment";
import { TrendChart } from "@/components/admin/TrendChart";
import { StoreBreakdownTable } from "@/components/admin/StoreBreakdownTable";
import { LOW_READS_THRESHOLD, TREND_WEEK_LABELS } from "@/lib/admin/constants";
import { totals, sumTrend } from "@/lib/admin/metrics";
import { getStoreSummaries } from "@/lib/admin/queries";
import { getBillingState } from "@/lib/billing/state";
import { getTrialResults } from "@/lib/billing/results";
import { formatMonthDay, trialDaysLeft, TRIAL_DAYS } from "@/lib/billing/trial";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { TrialBand, type TrialBandProps } from "@/components/admin/billing/TrialBand";
import { TrialStartedModal } from "@/components/admin/billing/TrialStartedModal";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

/**
 * Dashboard / トップ（Figma node 48:1016 PC / 48:1210 SP）。
 *
 * 2026-09-29、無料体験（A案「帯とモーダル」。Figma App Design Master `12 無料体験 / Trial`）の表示を足した。
 *   - 体験中：「無料体験 残り○日（○月○日まで）」の帯と、登録した日からの4つの数字（§3-5）。残り3日から警告の色
 *   - 解約の予約中：帯が「解約の手続きが済んでいます。○月○日までお使いいただけます。」
 *   - お休み：赤い帯と「カードを登録する」（見るだけ。§3-8）
 *   - カードを登録して戻った直後（?trial=started）：印刷して置く案内を重ねて出す
 */
export default async function AdminTopPage({ searchParams }: { searchParams: { trial?: string } }) {
  const [stores, billing] = await Promise.all([getStoreSummaries(), getBillingState()]);
  const total = totals(stores);
  const allStoresTrend = sumTrend(stores);

  const trialing = billing.status === "trialing" && billing.trialEndsAt !== null;
  const daysLeft = trialing ? trialDaysLeft(billing.trialEndsAt) ?? 0 : null;
  const endLabel = trialing ? formatMonthDay(billing.trialEndsAt!) : "";
  const trialStart = trialing ? new Date(new Date(billing.trialEndsAt!).getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString() : null;

  const band: TrialBandProps | null = billing.access.paused
    ? { kind: "paused" }
    : billing.cancelAt
      ? { kind: "cancel", cancelLabel: formatMonthDay(billing.cancelAt), daysLeft }
      : trialing
        ? { kind: "trial", daysLeft: daysLeft ?? 0, endLabel }
        : null;

  // 体験中は「カードを登録した日から」の4つの数字を出す（Google に実際に投稿された数は出さない。取得していない）
  let results: Awaited<ReturnType<typeof getTrialResults>> | null = null;
  if (trialing && trialStart) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id as string | undefined;
    if (tenantId) results = await getTrialResults(supabase, tenantId, trialStart);
  }

  // カードを登録して戻った直後：印刷して置く案内に使う二次元コード
  const justStarted = searchParams.trial === "started" && trialing;
  const startedStores = justStarted
    ? await Promise.all(stores.map(async (s) => ({ id: s.id, name: s.name, slug: s.slug, qrSvg: await generateQrSvg(`${PUBLIC_APP_URL}/r/${s.slug}`) })))
    : [];

  // 二次元コードの読み取りが少ない店舗（2026-08-23、設定＞店舗管理からここへ移した。
  // Figmaコメント 1895821315「ここは集計や分析画面ではないので、トップページに移動する」）。
  // 体験中は出さない（置いた直後は読み取りが少ないのが当たり前で、上の数字が代わりを務める）
  const lowReadStores = trialing ? [] : stores.filter((s) => s.qrReads < LOW_READS_THRESHOLD);

  return (
    <>
      <AdminMobileTopBar title="トップ" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          トップ
        </p>
        <div className="flex flex-col items-end gap-2">
          <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
            期間
          </p>
          <PeriodSegment />
        </div>
      </div>
      <div
        className="flex w-full shrink-0 flex-col items-start gap-2 rounded-2xl p-4 md:hidden"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
          期間
        </p>
        <PeriodSegment />
      </div>

      {band && <TrialBand {...band} />}
      {justStarted && <TrialStartedModal stores={startedStores} daysLeft={daysLeft ?? TRIAL_DAYS} endLabel={endLabel} />}

      {lowReadStores.length > 0 && (
        <div
          className="flex w-full shrink-0 flex-col items-start gap-1 rounded-2xl px-4 py-3 md:px-6 md:py-4"
          style={{ backgroundColor: "var(--product-color-status-warning-wash)" }}
        >
          <p className="text-[13px] font-bold" style={{ color: "var(--product-color-status-warning)" }}>
            二次元コードの読み取りが少なくなっています
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {lowReadStores.map((s) => s.name).join("・")}（直近7日）。卓上POPが片付けられていないか、置き場所をご確認ください
          </p>
        </div>
      )}

      {results && trialStart ? (
        <div className="grid w-full shrink-0 grid-cols-2 gap-2 md:flex md:gap-4">
          <KpiCard label="読み取られた数" value={String(results.scans)} unit="回" prevLabel={`${formatMonthDay(trialStart)}から`} wrapLabel />
          <KpiCard label="回答の数" value={String(results.responses)} prevLabel={`${formatMonthDay(trialStart)}から`} wrapLabel />
          <KpiCard
            label="Googleの投稿画面を開いた数"
            value={String(results.openedGoogle)}
            unit="回"
            prevLabel={`${formatMonthDay(trialStart)}から`}
            note="投稿画面を開いた数です。実際に投稿された数ではありません"
            wrapLabel
          />
          <KpiCard label="お店にだけ届いた声" value={String(results.storeOnly)} prevLabel={`${formatMonthDay(trialStart)}から`} wrapLabel />
        </div>
      ) : (
      <div className="flex w-full shrink-0 flex-col items-start gap-2 md:flex-row md:gap-4">
        <KpiCard
          label="回答数"
          note="アンケートに答えていただいた数です"
          value={String(total.responseCount)}
          prevLabel={`前期 ${total.responseCountPrev}件`}
          delta={toDelta(total.responseCount, total.responseCountPrev, "件")}
        />
        <KpiCard
          label="Googleへ送客（誘導数）"
          value={String(total.routeCount)}
          prevLabel={`前期 ${total.routeCountPrev}件`}
          delta={toDelta(total.routeCount, total.routeCountPrev, "件")}
          note="レビュー画面を開いた数です。実際に投稿された数ではありません"
        />
        <KpiCard
          label="送客率"
          value={total.routeRatePercent === null ? "—" : `${total.routeRatePercent}%`}
          prevLabel={`前期 ${total.routeRatePercentPrev === null ? "—" : `${total.routeRatePercentPrev}%`}`}
          delta={toDelta(total.routeRatePercent, total.routeRatePercentPrev, "pt")}
          unit=""
          note="回答したお客様のうち、Googleのレビュー画面へ進んだ割合です"
        />
      </div>
      )}

      <div
        className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-4 md:p-6"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex w-full items-baseline gap-2">
          <p className="text-[15px] font-bold md:text-[17px]" style={{ color: "var(--product-color-text-primary)" }}>
            Googleへの送客数の推移
          </p>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            直近5週
          </p>
        </div>
        <TrendChart values={allStoresTrend} labels={TREND_WEEK_LABELS} unit="" />
      </div>

      <StoreBreakdownTable stores={stores} />
    </>
  );
}
