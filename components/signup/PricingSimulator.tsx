"use client";

import { BILLING, formatYen } from "@/lib/admin/constants";
import { MAX_STORES, monthlyYenFor } from "@/lib/signup/plan";

/**
 * 料金シミュレーション（Figma `11 新規登録 / Signup`）。
 *
 * 料金ページと申し込み画面の両方で使う。**金額の出し方を1箇所にまとめる**ため部品にした。
 * 画面ごとに計算を書くと、片方だけ直して食い違う。
 *
 * 金額は `lib/admin/constants.ts` の `BILLING` を見る。**画面に数字を直書きしない。**
 */

export function PricingSimulator({
  storeCount,
  onChange,
  compact = false,
  countLabel = "店舗数",
  totalLabel = "お申し込み後の月額",
  min = 1,
}: {
  storeCount: number;
  onChange: (next: number) => void;
  /** 申し込み画面では内訳を省いて合計だけ出す */
  compact?: boolean;
  /** ステッパー行のラベル。設定＞お支払いでは「店舗枠」（2026-08-25、天真の指示で共用化） */
  countLabel?: string;
  /** 合計行のラベル。設定＞お支払いでは「変更後の月額」 */
  totalLabel?: string;
  /** 下限。設定＞お支払いでは「いま使っている店舗数」より減らせない */
  min?: number;
}) {
  const extra = Math.max(0, storeCount - BILLING.includedStores);
  const total = monthlyYenFor(storeCount);

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* タップ領域44pxを確保する（SPで押しにくくならないように） */}
      <div
        className="flex w-full items-center gap-4 rounded-2xl px-4 py-3"
        style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
          {countLabel}
        </p>
        <div className="flex flex-1 items-center justify-end gap-4">
          <button
            type="button"
            aria-label="店舗数を減らす"
            disabled={storeCount <= min}
            onClick={() => onChange(Math.max(min, storeCount - 1))}
            className="grid h-11 w-11 place-items-center rounded-full text-lg font-bold disabled:opacity-40"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              color: "var(--product-color-text-secondary)",
            }}
          >
            −
          </button>
          <span
            className="min-w-8 text-center text-[22px] font-bold tabular-nums"
            style={{ color: "var(--product-color-text-primary)" }}
            aria-live="polite"
          >
            {storeCount}
          </span>
          <button
            type="button"
            aria-label="店舗数を増やす"
            disabled={storeCount >= MAX_STORES}
            onClick={() => onChange(Math.min(MAX_STORES, storeCount + 1))}
            className="grid h-11 w-11 place-items-center rounded-full text-lg font-bold disabled:opacity-40"
            style={{
              backgroundColor: "var(--review-accent-primary)",
              color: "var(--review-accent-on-primary)",
            }}
          >
            ＋
          </button>
        </div>
      </div>

      {!compact && (
        <div className="flex w-full flex-col gap-3">
          <Row label={`基本プラン（${BILLING.includedStores}店舗まで）`} value={formatYen(BILLING.planMonthlyYen)} />
          <Row label={`追加店舗 × ${extra}`} value={formatYen(extra * BILLING.additionalStoreMonthlyYen)} />
        </div>
      )}

      <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

      <div className="flex w-full items-center justify-between gap-3">
        <p className="text-[14px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {totalLabel}
        </p>
        <p className="text-[24px] font-bold tabular-nums" style={{ color: "var(--review-accent-primary)" }}>
          {formatYen(total)}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>
      <p className="text-[13.5px] tabular-nums" style={{ color: "var(--product-color-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
