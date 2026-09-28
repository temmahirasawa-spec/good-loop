/**
 * お支払いまわりの型（docs/specs/billing.md）。
 *
 * サーバー側（lib/billing/*）とクライアント側（SettingsBillingView）の両方が使うため、
 * `server-only` を付けないこのファイルに置いている。**値は持たせない。型だけ。**
 */

/**
 * 契約の状態（supabase/0013・0017、docs/specs/billing.md §5-1）。
 *
 * | 値 | 状態 |
 * |---|---|
 * | none | カード未登録（申し込み直後、または営業経由） |
 * | trialing | 無料体験中（2026-09-28 追加。それまでは active に丸めていた） |
 * | active | 有料期間 |
 * | past_due | 請求が通らなかった。**止めない** |
 * | canceled | 解約して期間が終わった・再請求が尽きた ＝ **お休み** |
 */
export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

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
