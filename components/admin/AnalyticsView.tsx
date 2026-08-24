"use client";

import { SURVEY_TALLY_NOTE } from "@/lib/admin/constants";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import type { PeriodValue } from "@/lib/admin/period";
import type { TagAggregate, TagAggregates } from "@/lib/admin/queries";

/**
 * Dashboard / 集計（Figma `05 集計 / Analytics`、案A＝横棒ランキング）。
 *
 * 仕様は docs/specs/analytics.md。データ取得は親
 * （app/admin/(dashboard)/analytics/page.tsx）が行う。
 *
 * **1店舗ずつしか見せない。** 店舗ごとにアンケート項目が違うため、横並びに合計すると
 * 別の項目を足し算してしまう（analytics.md 1章）。
 */

type StoreOption = { id: string; name: string };

// 文言は lib/admin/constants.ts に集約（オンボーディングのステップ4と共通）

/** 1項目ぶんの横棒。PCは1行、SPは2段に折り返す */
function BarRow({ item, color }: { item: TagAggregate; color: string }) {
  const width = item.percent ?? 0;
  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <div className="flex items-baseline gap-2 md:w-[160px] md:shrink-0">
        <p className="flex-1 text-sm md:flex-none" style={{ color: item.archived ? "var(--product-color-text-tertiary)" : "var(--product-color-text-primary)" }}>
          {item.label}
          {/* アーカイブ済み（supabase/0016）。項目としては終了しているが、過去の集計は残す */}
          {item.archived && (
            <span className="ml-1 text-[10.5px] font-medium" style={{ color: "var(--product-color-text-muted)" }}>
              （受付終了）
            </span>
          )}
        </p>
        <div className="flex items-baseline gap-2 md:hidden">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {item.count}件
          </p>
          <p className="text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
            {item.percent === null ? "—" : `${item.percent}%`}
          </p>
        </div>
      </div>

      <div
        className="h-[10px] w-full overflow-hidden rounded-full md:h-3 md:flex-1"
        style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}
      >
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>

      <p className="hidden w-14 shrink-0 text-right text-sm font-bold md:block" style={{ color: "var(--product-color-text-primary)" }}>
        {item.count}件
      </p>
      <p className="hidden w-12 shrink-0 text-right text-sm md:block" style={{ color: "var(--product-color-text-secondary)" }}>
        {item.percent === null ? "—" : `${item.percent}%`}
      </p>
    </div>
  );
}

function RankingCard({
  title,
  sub,
  items,
  color,
}: {
  title: string;
  sub: string;
  items: TagAggregate[];
  color: string;
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col items-start gap-4 rounded-2xl p-4 md:p-6"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <div className="flex flex-col items-start gap-0.5 md:flex-row md:items-baseline md:gap-2">
        <p className="text-[15px] font-bold md:text-[17px]" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </p>
        <p className="text-[11px] font-medium md:text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
          {sub}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--product-color-text-tertiary)" }}>
          この分岐の項目がまだありません
        </p>
      ) : (
        items.map((item) => <BarRow key={item.tagId} item={item} color={color} />)
      )}
    </div>
  );
}

/** 回答が無い・期間内に無い・エラーのときに出す1枚もの */
function MessageCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col items-center gap-3 rounded-2xl px-6 py-10 md:py-16"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="text-center text-[15px] font-bold md:text-[17px]" style={{ color: "var(--product-color-text-primary)" }}>
        {title}
      </p>
      <p className="max-w-[420px] text-center text-[13px] md:text-sm" style={{ color: "var(--product-color-text-secondary)" }}>
        {body}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function AnalyticsView({
  aggregates,
  storeOptions,
  storeId,
  period,
}: {
  aggregates: TagAggregates;
  storeOptions: StoreOption[];
  storeId: string;
  period: PeriodValue;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(next: { storeId?: string; period?: PeriodValue }) {
    const merged = { storeId: next.storeId ?? storeId, period: next.period ?? period };
    const params = new URLSearchParams();
    if (merged.storeId) params.set("store", merged.storeId);
    if ("preset" in merged.period) {
      if (merged.period.preset !== "7d") params.set("period", merged.period.preset);
    } else {
      params.set("from", merged.period.from);
      params.set("to", merged.period.to);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const storeName = storeOptions.find((s) => s.id === storeId)?.name ?? "";
  const hasAnyResponse = aggregates.responseCountAllTime > 0;
  const hasResponseInPeriod = aggregates.responseCount > 0;

  return (
    <>
      <AdminMobileTopBar title="集計" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          集計
        </p>
        <div className="flex items-center gap-4">
          <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {aggregates.responseCount}件の回答
          </p>
          <PeriodPicker value={period} onChange={(next) => update({ period: next })} />
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center gap-3">
        <div
          className="relative flex h-11 flex-1 items-center rounded-xl border pl-4 pr-3 md:flex-none md:w-[240px]"
          style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
        >
          <select
            value={storeId}
            onChange={(e) => update({ storeId: e.target.value })}
            aria-label="店舗を選ぶ"
            className="w-full appearance-none bg-transparent text-[13px] outline-none"
            style={{ color: "var(--product-color-text-primary)" }}
          >
            {storeOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="pointer-events-none absolute right-3 text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
            ▾
          </p>
        </div>
        <p className="whitespace-nowrap text-[13px] font-medium md:hidden" style={{ color: "var(--product-color-text-secondary)" }}>
          {aggregates.responseCount}件
        </p>
      </div>
      <div className="w-full md:hidden">
        <PeriodPicker value={period} onChange={(next) => update({ period: next })} />
      </div>

      {hasResponseInPeriod ? (
        <div
          className="w-full shrink-0 rounded-lg px-4 py-3"
          style={{ backgroundColor: "var(--review-accent-wash)" }}
        >
          <p className="text-xs md:text-[13px]" style={{ color: "var(--product-color-text-primary)" }}>
            {SURVEY_TALLY_NOTE}
          </p>
        </div>
      ) : null}

      {!hasAnyResponse ? (
        <MessageCard
          title="まだ回答がありません"
          body={`${storeName}には、まだ回答が届いていません。卓上POPの二次元コードを読み取って回答が届くと、ここに項目ごとの集計が出ます。`}
          action={
            <Link
              href="/admin/settings/pop"
              className="flex h-11 items-center rounded-lg px-5"
              style={{ backgroundColor: "var(--review-cta-primary)" }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--review-cta-on-primary)" }}>
                卓上POPを作る
              </span>
            </Link>
          }
        />
      ) : !hasResponseInPeriod ? (
        <MessageCard
          title="この期間の回答はありません"
          body="期間を広げると表示されることがあります。"
          action={
            <button
              type="button"
              onClick={() => update({ period: { preset: "90d" } })}
              className="flex h-11 items-center rounded-lg border px-5"
              style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                直近3ヶ月にする
              </span>
            </button>
          }
        />
      ) : (
        <>
          <RankingCard
            title="良かった点"
            sub={`★4〜5 の回答 ${aggregates.goodResponseCount}件`}
            items={aggregates.good}
            color="var(--review-accent-primary)"
          />
          <RankingCard
            title="改善点"
            sub={`★1〜3 の回答 ${aggregates.improveResponseCount}件`}
            items={aggregates.improve}
            color="var(--product-color-secondary-primary)"
          />
        </>
      )}
    </>
  );
}
