import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { billingAccess, type BillingAccess } from "@/lib/billing/access";
import type { BillingStatus } from "@/lib/billing/types";

/**
 * 契約先の課金状態（supabase/0013・0017、docs/specs/billing.md §5）。
 *
 * カード番号・有効期限・名義は GOOD REVIEW 側に一切保存していない。
 * ここで読むのは「どの Stripe 顧客か」「契約の状態」「体験の終わり」「解約の予約」だけ。
 *
 * 画面に出すカードの下4桁と請求履歴も**保存しない**。表示のたびに Stripe へ
 * 取りに行く（lib/billing/stripe.ts の getBillingDisplay）。保存すると Stripe 側で
 * 変更されたときに古い情報を出し続けてしまうため（docs/specs/billing.md §6）。
 */

export type BillingState = {
  status: BillingStatus;
  /**
   * 生きている契約（サブスクリプション）があるか。
   *
   * **顧客IDの有無で判定してはいけない**（2026-08-24 の事故）。Stripe の顧客は
   * カードを登録する前、決済画面を作る時点で先に作られる。前回の登録が途中で
   * 失敗していると顧客IDだけが残り、カードが無いのに「登録済み」と誤判定して
   * 「お支払い方法を登録する」が画面から消える。実際にそうなった。
   *
   * 解約して期間が終わった契約は、契約IDが残っていても「無い」とみなす（§12 の3）。
   */
  subscribed: boolean;
  /** 今の請求期間の終わり（＝次回のお支払い日）。ISO文字列。未接続なら null */
  currentPeriodEnd: string | null;
  /** Stripe 側の顧客ID。カードと請求履歴を取りに行くのに使う */
  customerId: string | null;
  /** 申し込みから来た契約先か（supabase/0017） */
  cardRequired: boolean;
  /** 体験の終わり（Stripe の trial_end）。体験中でなければ null */
  trialEndsAt: string | null;
  /** 解約の予約日。予約していなければ null */
  cancelAt: string | null;
  /** いま何ができるか（lib/billing/access.ts） */
  access: BillingAccess;
};

const DISCONNECTED: BillingState = {
  status: "none",
  subscribed: false,
  currentPeriodEnd: null,
  customerId: null,
  cardRequired: false,
  trialEndsAt: null,
  cancelAt: null,
  access: billingAccess({ stripeEnabled: false, cardRequired: false, status: "none", hasSubscription: false }),
};

export function toBillingStatus(value: unknown): BillingStatus {
  return value === "trialing" || value === "active" || value === "past_due" || value === "canceled" ? value : "none";
}

export type TenantBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_status: string | null;
  billing_current_period_end: string | null;
  card_required: boolean | null;
  trial_ends_at: string | null;
  billing_cancel_at: string | null;
};

export const TENANT_BILLING_COLUMNS =
  "stripe_customer_id, stripe_subscription_id, billing_status, billing_current_period_end, card_required, trial_ends_at, billing_cancel_at";

/** tenants の行から状態を組み立てる。来店客の画面（ログインしない）からも使うため、読み方と分けてある */
export function billingStateFromRow(row: TenantBillingRow): BillingState {
  const status = toBillingStatus(row.billing_status);
  const hasSubscription = Boolean(row.stripe_subscription_id);
  const cardRequired = Boolean(row.card_required);
  return {
    status,
    subscribed: hasSubscription && status !== "canceled",
    currentPeriodEnd: row.billing_current_period_end,
    customerId: row.stripe_customer_id,
    cardRequired,
    trialEndsAt: status === "trialing" ? row.trial_ends_at : null,
    cancelAt: row.billing_cancel_at,
    access: billingAccess({ stripeEnabled: STRIPE_ENABLED, cardRequired, status, hasSubscription }),
  };
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
    .select(TENANT_BILLING_COLUMNS)
    .eq("id", tenantId)
    .maybeSingle<TenantBillingRow>();

  // 読めなかったときは「未接続」に倒す。存在しない契約を「契約中」と表示するより、
  // 「未登録」と出して登録を促すほうが害が小さい
  if (!data) return DISCONNECTED;

  return billingStateFromRow(data);
}

/** お休みのあいだに断るときの文（画面にそのまま出る） */
export const PAUSED_EDIT_MESSAGE = "お休み中は設定を変更できません。カードを登録すると再開できます。";

/**
 * お休み（見るだけ）のあいだは、設定を変える API を断る（docs/specs/billing.md §3-8）。
 * 断るときは 403 の応答を返す。通してよいときは null。
 */
export async function refuseWhenPaused(): Promise<NextResponse | null> {
  const billing = await getBillingState();
  if (!billing.access.paused) return null;
  return NextResponse.json({ error: PAUSED_EDIT_MESSAGE, code: "paused" }, { status: 403 });
}
