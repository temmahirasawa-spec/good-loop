import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * 契約先の課金状態（supabase/0013、docs/specs/billing.md 4章）。
 *
 * カード番号・有効期限・名義は GOOD REVIEW 側に一切保存していない。
 * ここで読むのは「どの Stripe 顧客か」「契約が正常か」「次回の請求日はいつか」だけ。
 *
 * 画面に出すカードの下4桁と請求履歴も**保存しない**。表示のたびに Stripe へ
 * 取りに行く（lib/billing/stripe.ts の getBillingDisplay）。保存すると Stripe 側で
 * 変更されたときに古い情報を出し続けてしまうため（docs/specs/billing.md 5章）。
 */

export type BillingState = {
  status: BillingStatus;
  /**
   * 契約（サブスクリプション）があるか。
   *
   * **顧客IDの有無で判定してはいけない**（2026-08-24 の事故）。Stripe の顧客は
   * カードを登録する前、決済画面を作る時点で先に作られる。前回の登録が途中で
   * 失敗していると顧客IDだけが残り、カードが無いのに「登録済み」と誤判定して
   * 「お支払い方法を登録する」が画面から消える。実際にそうなった。
   */
  subscribed: boolean;
  /** 今の請求期間の終わり（＝次回のお支払い日）。ISO文字列。未接続なら null */
  currentPeriodEnd: string | null;
  /** Stripe 側の顧客ID。カードと請求履歴を取りに行くのに使う */
  customerId: string | null;
};

const DISCONNECTED: BillingState = { status: "none", subscribed: false, currentPeriodEnd: null, customerId: null };

function toStatus(value: unknown): BillingStatus {
  return value === "active" || value === "past_due" || value === "canceled" ? value : "none";
}

export async function getBillingState(): Promise<BillingState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) return DISCONNECTED;

  const { data } = await supabase
    .from("tenants")
    .select("stripe_customer_id, stripe_subscription_id, billing_status, billing_current_period_end")
    .eq("id", tenantId)
    .maybeSingle<{
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      billing_status: string | null;
      billing_current_period_end: string | null;
    }>();

  // 読めなかったときは「未接続」に倒す。存在しない契約を「契約中」と表示するより、
  // 「未登録」と出して登録を促すほうが害が小さい
  if (!data) return DISCONNECTED;

  return {
    status: toStatus(data.billing_status),
    subscribed: Boolean(data.stripe_subscription_id),
    currentPeriodEnd: data.billing_current_period_end,
    customerId: data.stripe_customer_id,
  };
}
