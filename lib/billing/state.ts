import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 契約先の課金状態（supabase/0013、docs/specs/billing.md 4章）。
 *
 * カード番号・有効期限・名義は GOOD REVIEW 側に一切保存していない。
 * ここで読むのは「どの Stripe 顧客か」「契約が正常か」「次回の請求日はいつか」だけ。
 * カードの下4桁のような表示用の情報も持たない（＝画面に出さない。出したければ
 * Stripe のカスタマーポータルへ送る。docs/specs/billing.md 5章）。
 */

export type BillingStatus = "none" | "active" | "past_due" | "canceled";

export type BillingState = {
  status: BillingStatus;
  /** カードを登録して Stripe と繋がっているか */
  connected: boolean;
  /** 今の請求期間の終わり（＝次回のお支払い日）。ISO文字列。未接続なら null */
  currentPeriodEnd: string | null;
};

const DISCONNECTED: BillingState = { status: "none", connected: false, currentPeriodEnd: null };

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
    .select("stripe_customer_id, billing_status, billing_current_period_end")
    .eq("id", tenantId)
    .maybeSingle<{
      stripe_customer_id: string | null;
      billing_status: string | null;
      billing_current_period_end: string | null;
    }>();

  // 読めなかったときは「未接続」に倒す。存在しない契約を「契約中」と表示するより、
  // 「未登録」と出して登録を促すほうが害が小さい
  if (!data) return DISCONNECTED;

  return {
    status: toStatus(data.billing_status),
    connected: Boolean(data.stripe_customer_id),
    currentPeriodEnd: data.billing_current_period_end,
  };
}
