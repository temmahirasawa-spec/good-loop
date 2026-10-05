import type { BillingStatus } from "@/lib/billing/types";

/**
 * 「いま何ができるか」の判定（docs/specs/billing.md §3-2・§3-8）。
 *
 * **判定はここだけで行う。** 管理画面・二次元コード・卓上POP・店舗枠・来店客のアンケートが、
 * それぞれ別の条件で止めたり通したりすると、必ずどこかで食い違う。
 *
 * 秘密の値を持たないので、サーバーと画面の両方から呼べる（`stripeEnabled` は呼び出し側が渡す）。
 */

export type BillingAccess = {
  /**
   * カードの登録が要る（＝カードの関門を出す）。
   * 申し込みから来て契約がまだ無いとき（`card_required`）と、お休みのとき。
   */
  needsCard: boolean;
  /** お休み（解約して期間が終わった・再請求が尽きた）。管理画面は見るだけ */
  paused: boolean;
  /**
   * 来店客のアンケートを止めるか（Q2）。
   * 二次元コードを出さなくても、URL を割り出されて使われうるため、画面とAPIの両方で止める。
   */
  surveyStopped: boolean;
  /** 二次元コードの表示・卓上POP・店舗枠の追加ができるか */
  canUseStoreFeatures: boolean;
  /** 設定を変えられるか（お休みのあいだは見るだけ） */
  canEdit: boolean;
};

const OPEN: BillingAccess = { needsCard: false, paused: false, surveyStopped: false, canUseStoreFeatures: true, canEdit: true };

export function billingAccess(input: {
  /** Stripe の鍵がそろっているか（lib/billing/config.ts の STRIPE_ENABLED） */
  stripeEnabled: boolean;
  /** `tenants.card_required`。申し込みから来た契約先だけ true */
  cardRequired: boolean;
  status: BillingStatus;
  /** `tenants.stripe_subscription_id` があるか */
  hasSubscription: boolean;
}): BillingAccess {
  // 鍵が無い環境では、カードを登録する手段が無い。止めると先に進めなくなるので、今までどおり通す（§9）
  if (!input.stripeEnabled) return OPEN;

  // 解約して期間が終わった（または再請求が尽きた）。もう一度カードを登録するまでお休み（§3-8）
  const paused = input.status === "canceled";

  // 生きている契約。未払い（past_due）は**止めない**（8/24 の決まりのまま。§3-8）
  const live = input.hasSubscription && !paused;

  const needsCard = !live && (input.cardRequired || paused);

  return {
    needsCard,
    paused,
    surveyStopped: needsCard,
    canUseStoreFeatures: !needsCard,
    canEdit: !paused,
  };
}
