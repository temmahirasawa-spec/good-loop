"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoopButton } from "@/components/rating-flow/Button";
import { BILLING, formatYen } from "@/lib/admin/constants";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { BillingIcon } from "@/components/admin/SettingsMenuIcons";

const INVOICES = [
  { month: "2026年7月", amount: "9,800円" },
  { month: "2026年6月", amount: "9,800円" },
  { month: "2026年5月", amount: "9,800円" },
];

type QuotaProps = { quota: number | null; used: number; hasPendingRequest: boolean };

/**
 * 設定（お支払い） Figma node 73:1399 PC / 75:1862 SP の表示部分。
 *
 * 2026-08-21、**店舗枠**の欄を追加した（天真の依頼。店舗の追加には追加課金が要る）。
 * Stripe はまだ未接続（docs/setup-tasks.md 7）なので、
 * 「店舗枠を追加する」は決済ではなく**申し込み**（POST /api/admin/settings/store-quota）。
 * 運営が入金を確認して枠を増やすと、店舗・二次元コード管理から店舗を追加できるようになる。
 *
 * プラン変更・支払い方法変更・領収書ダウンロードは、Stripe が入るまで見た目のみで動かない
 * （これは2026-08-06時点からの据え置き）。
 *
 * 金額は lib/admin/constants.ts の BILLING を参照する。**画面に金額を直書きしない。**
 */
export function SettingsBillingView({ quota }: { quota: QuotaProps }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 枠が読み取れなかったときは金額を計算できない（数字を出さず「—」にする）
  const extraStores = quota.quota === null ? null : Math.max(0, quota.quota - BILLING.includedStores);
  const monthlyTotal = extraStores === null ? null : BILLING.planMonthlyYen + extraStores * BILLING.additionalStoreMonthlyYen;
  const requested = done || quota.hasPendingRequest;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/store-quota", { method: "POST" });
      if (res.ok) {
        setDone(true);
        setConfirming(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "申し込めませんでした。もう一度お試しください。");
      }
    } catch {
      setError("申し込めませんでした。もう一度お試しください。");
    }
    setSubmitting(false);
  }

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <SettingsCardTitle icon={<BillingIcon />}>お支払い</SettingsCardTitle>

        {/* SPは値が長いと右端で切れるので、ラベルと値を2行にする（2026-08-22 天真のFigmaコメント） */}
        <div className="flex w-full items-start justify-between gap-3 py-2 md:h-12 md:items-center md:py-0">
          <div className="flex min-w-0 flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-4">
            <p className="text-[12.5px] md:w-[140px] md:shrink-0" style={{ color: "var(--product-color-text-secondary)" }}>
              プラン
            </p>
            <p className="text-[13.5px] md:whitespace-nowrap" style={{ color: "var(--product-color-text-primary)" }}>
              {BILLING.planLabel}（月額 {formatYen(BILLING.planMonthlyYen)}・{BILLING.includedStores}店舗まで）
            </p>
          </div>
          <p className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
            プランを変更
          </p>
        </div>

        <div className="flex w-full items-start justify-between gap-3 py-2 md:h-12 md:items-center md:py-0">
          <div className="flex min-w-0 flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-4">
            <p className="text-[12.5px] md:w-[140px] md:shrink-0" style={{ color: "var(--product-color-text-secondary)" }}>
              お支払い方法
            </p>
            <p className="text-[13.5px] md:whitespace-nowrap" style={{ color: "var(--product-color-text-primary)" }}>
              Visa •••• 6411
            </p>
          </div>
          <p className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
            変更
          </p>
        </div>

        <p className="pt-2 text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          請求履歴
        </p>
        {INVOICES.map((inv) => (
          <div key={inv.month} className="flex w-full flex-col items-start gap-1 border-b py-2 md:h-11 md:flex-row md:items-center md:justify-between md:gap-0 md:py-0" style={{ borderColor: "var(--product-color-border-divider)" }}>
            <div className="flex items-center gap-4 text-[12.5px]">
              <p style={{ color: "var(--product-color-text-primary)" }}>{inv.month}</p>
              <p style={{ color: "var(--product-color-text-secondary)" }}>{inv.amount}</p>
            </div>
            <p className="text-xs" style={{ color: "var(--loop-accent-action)" }}>
              領収書をダウンロード
            </p>
          </div>
        ))}
        <LoopButton variant="outline">請求履歴をすべて見る</LoopButton>
      </div>

      {/* ── 店舗枠（2026-08-21 追加） ───────────────────────── */}
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          店舗枠
        </p>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          店舗を追加するには、先に店舗枠を追加してください。追加1店舗につき月額 {formatYen(BILLING.additionalStoreMonthlyYen)} です
        </p>

        <div className="flex w-full items-center justify-between border-b py-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            契約中の店舗枠
          </p>
          <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {quota.quota === null ? "—" : `${quota.used} / ${quota.quota} 店舗`}
          </p>
        </div>
        <div className="flex w-full items-center justify-between border-b py-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            現在の月額
          </p>
          <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {monthlyTotal === null ? "—" : formatYen(monthlyTotal)}
          </p>
        </div>

        {requested ? (
          <div className="flex w-full flex-col items-start gap-1 rounded-xl p-4" style={{ backgroundColor: "var(--loop-accent-wash)" }}>
            <p className="text-[13px] font-bold" style={{ color: "var(--loop-accent-action)" }}>
              店舗枠の追加を承りました
            </p>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              担当者が確認のうえご連絡します。手続きが済むと、店舗管理から店舗を追加できるようになります
            </p>
          </div>
        ) : (
          <LoopButton variant="primary" disabled={quota.quota === null} onClick={() => setConfirming(true)}>
            ＋ 店舗枠を追加する
          </LoopButton>
        )}
      </div>

      {confirming && (
        // スクリム（背景の暗幕）は AddStoreModal / StoreEditModal と同じ形にそろえる
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => !submitting && setConfirming(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full flex-col items-start gap-4 overflow-y-auto rounded-t-[20px] p-6 md:w-[420px] md:rounded-2xl"
            style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              店舗枠を追加する
            </p>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              店舗枠を {quota.quota} 店舗から {(quota.quota ?? 0) + 1} 店舗に増やします。月額は{" "}
              {monthlyTotal === null ? "—" : formatYen(monthlyTotal)} から{" "}
              {monthlyTotal === null ? "—" : formatYen(monthlyTotal + BILLING.additionalStoreMonthlyYen)} になります。
              お申し込み後、担当者が確認のうえご連絡します
            </p>
            {error && (
              <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
                {error}
              </p>
            )}
            <LoopButton variant="primary" disabled={submitting} onClick={submit}>
              {submitting ? "送信中..." : "この内容で申し込む"}
            </LoopButton>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="w-full text-center text-[12.5px] font-medium"
              style={{ color: "var(--product-color-text-secondary)" }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </>
  );
}
