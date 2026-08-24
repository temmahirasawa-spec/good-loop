"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewButton } from "@/components/rating-flow/Button";
import { BILLING, formatYen } from "@/lib/admin/constants";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { BillingIcon } from "@/components/admin/SettingsMenuIcons";

/** Stripe から都度取得する表示用の情報（DBには保存しない。docs/specs/billing.md 5章） */
export type BillingCard = { brand: string; last4: string };
export type BillingInvoice = {
  id: string;
  /** 「2026年7月」 */
  periodLabel: string;
  /** 「9,800円」 */
  amountLabel: string;
  /** 領収書のURL。Stripe が発行する。取れないことがある */
  receiptUrl: string | null;
};

export type BillingStatus = "none" | "active" | "past_due" | "canceled";

type QuotaProps = { quota: number | null; used: number; hasPendingRequest: boolean };

type Props = {
  quota: QuotaProps;
  billing: { status: BillingStatus; connected: boolean };
  /** Stripe の鍵が揃っているか。揃っていなければ課金の導線を出さない（docs/specs/billing.md 7章） */
  stripeEnabled: boolean;
  card: BillingCard | null;
  invoices: BillingInvoice[];
  /** Stripe への問い合わせに失敗したか。失敗しても画面は壊さず、その欄だけ断りを出す */
  lookupFailed: boolean;
};

/**
 * 設定（お支払い） Figma node 73:1399 PC / 75:1862 SP の表示部分。
 *
 * 2026-08-24、Stripe を接続した（docs/specs/billing.md）。
 * それまでこの画面には**実在しないカード番号（Visa •••• 6411）と実在しない請求履歴3件**が
 * 固定値で並んでいた。契約先に見せると事実と食い違うため、すべて実データに差し替えた。
 *
 * カード番号の入力は Stripe の画面（Checkout / カスタマーポータル）に任せる。
 * この画面にカードの入力欄は無く、GOOD REVIEW のサーバーをカード番号が通ることもない。
 *
 * 金額は lib/admin/constants.ts の BILLING を参照する。**画面に金額を直書きしない。**
 */
export function SettingsBillingView({ quota, billing, stripeEnabled, card, invoices, lookupFailed }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 枠が読み取れなかったときは金額を計算できない（数字を出さず「—」にする）
  const extraStores = quota.quota === null ? null : Math.max(0, quota.quota - BILLING.includedStores);
  const monthlyTotal = extraStores === null ? null : BILLING.planMonthlyYen + extraStores * BILLING.additionalStoreMonthlyYen;

  /** カードで決済できる状態か。鍵が揃っていて、かつカード登録済み */
  const canPay = stripeEnabled && billing.connected;
  /** 枠の追加が「申し込み」で処理される状態か（Stripe未接続の運用。supabase/0011） */
  const requested = !canPay && (done || quota.hasPendingRequest);

  /** Stripe の画面へ送る。URLはサーバー側で作る（鍵をブラウザに出さないため） */
  async function openStripe(path: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.url === "string") {
        window.location.href = data.url;
        return; // 遷移するので submitting は戻さない
      }
      setError(typeof data?.error === "string" ? data.error : "お支払いの画面を開けませんでした。もう一度お試しください。");
    } catch {
      setError("お支払いの画面を開けませんでした。もう一度お試しください。");
    }
    setSubmitting(false);
  }

  /** 店舗枠を1つ増やす。カード登録済みなら決済、そうでなければ申し込み */
  async function submitQuota() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(canPay ? "/api/admin/billing/quota" : "/api/admin/settings/store-quota", { method: "POST" });
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

  /** 「プランを変更」「変更」など、Stripe の画面へ送るだけの小さなリンク */
  function StripeLink({ children, path }: { children: React.ReactNode; path: string }) {
    return (
      <button
        type="button"
        disabled={submitting}
        onClick={() => openStripe(path)}
        className="whitespace-nowrap text-[12.5px] disabled:opacity-50"
        style={{ color: "var(--review-accent-primary)" }}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <SettingsCardTitle icon={<BillingIcon />}>お支払い</SettingsCardTitle>

        {/* お支払いが止まっているときの断り。Figma には無い要素（2026-08-24 追加、天真確認中） */}
        {(billing.status === "past_due" || billing.status === "canceled") && (
          <div className="flex w-full flex-col items-start gap-1 rounded-xl p-4" style={{ backgroundColor: "var(--review-accent-wash)" }}>
            <p className="text-[13px] font-bold" style={{ color: "var(--product-color-status-warning)" }}>
              {billing.status === "past_due" ? "お支払いを確認できていません" : "ご契約が終了しています"}
            </p>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {billing.status === "past_due"
                ? "カードのお支払いが通りませんでした。お支払い方法をご確認ください。サービスは引き続きご利用いただけます"
                : "サービスは引き続きご利用いただけます。再開をご希望の場合はお支払い方法を登録してください"}
            </p>
          </div>
        )}

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
          {canPay && <StripeLink path="/api/admin/billing/portal">プランを変更</StripeLink>}
        </div>

        <div className="flex w-full items-start justify-between gap-3 py-2 md:h-12 md:items-center md:py-0">
          <div className="flex min-w-0 flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-4">
            <p className="text-[12.5px] md:w-[140px] md:shrink-0" style={{ color: "var(--product-color-text-secondary)" }}>
              お支払い方法
            </p>
            <p className="text-[13.5px] md:whitespace-nowrap" style={{ color: "var(--product-color-text-primary)" }}>
              {card ? `${card.brand} •••• ${card.last4}` : lookupFailed ? "取得できませんでした" : "未登録"}
            </p>
          </div>
          {canPay && <StripeLink path="/api/admin/billing/portal">変更</StripeLink>}
        </div>

        {/* カード未登録のとき、登録の入口をここに出す（Stripeの鍵が揃っている場合だけ） */}
        {stripeEnabled && !billing.connected && (
          <ReviewButton variant="primary" disabled={submitting} onClick={() => openStripe("/api/admin/billing/checkout")}>
            {submitting ? "開いています..." : "お支払い方法を登録する"}
          </ReviewButton>
        )}

        <p className="pt-2 text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          請求履歴
        </p>
        {invoices.length === 0 ? (
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {lookupFailed ? "取得できませんでした。時間をおいてお試しください" : "まだ請求はありません"}
          </p>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className="flex w-full flex-col items-start gap-1 border-b py-2 md:h-11 md:flex-row md:items-center md:justify-between md:gap-0 md:py-0" style={{ borderColor: "var(--product-color-border-divider)" }}>
              <div className="flex items-center gap-4 text-[12.5px]">
                <p style={{ color: "var(--product-color-text-primary)" }}>{inv.periodLabel}</p>
                <p style={{ color: "var(--product-color-text-secondary)" }}>{inv.amountLabel}</p>
              </div>
              {inv.receiptUrl && (
                <a href={inv.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: "var(--review-accent-primary)" }}>
                  領収書をダウンロード
                </a>
              )}
            </div>
          ))
        )}
        {canPay && (
          <ReviewButton variant="outline" disabled={submitting} onClick={() => openStripe("/api/admin/billing/portal")}>
            請求履歴をすべて見る
          </ReviewButton>
        )}

        {error && (
          <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            {error}
          </p>
        )}
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
          <div className="flex w-full flex-col items-start gap-1 rounded-xl p-4" style={{ backgroundColor: "var(--review-accent-wash)" }}>
            <p className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
              店舗枠の追加を承りました
            </p>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              担当者が確認のうえご連絡します。手続きが済むと、店舗管理から店舗を追加できるようになります
            </p>
          </div>
        ) : (
          <ReviewButton variant="primary" disabled={quota.quota === null || submitting} onClick={() => setConfirming(true)}>
            ＋ 店舗枠を追加する
          </ReviewButton>
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
              {canPay
                ? "ご登録のカードに、今月の残り日数ぶんの差額を今すぐご請求します"
                : "お申し込み後、担当者が確認のうえご連絡します"}
            </p>
            {error && (
              <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
                {error}
              </p>
            )}
            <ReviewButton variant="primary" disabled={submitting} onClick={submitQuota}>
              {submitting ? "送信中..." : canPay ? "この内容で支払う" : "この内容で申し込む"}
            </ReviewButton>
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
