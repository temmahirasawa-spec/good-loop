/**
 * お支払いまわりの型（docs/specs/billing.md）。
 *
 * サーバー側（lib/billing/*）とクライアント側（SettingsBillingView）の両方が使うため、
 * `server-only` を付けないこのファイルに置いている。**値は持たせない。型だけ。**
 */

export type BillingStatus = "none" | "active" | "past_due" | "canceled";

/** Stripe から都度取得する表示用のカード情報。DBには保存しない（同 5章） */
export type BillingCard = { brand: string; last4: string };

export type BillingInvoice = {
  id: string;
  /** 「2026年7月」 */
  periodLabel: string;
  /** 「9,800円」 */
  amountLabel: string;
  /** Stripe が発行する請求書のページ。領収書はここから取れる。取れないことがある */
  receiptUrl: string | null;
};
