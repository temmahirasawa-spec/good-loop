/**
 * 無料トライアルの状態（supabase/0014、docs/specs/billing.md 5-2）。
 *
 * **判定はここだけで行う。** `billing_status` に 'trial' を足していないのは、
 * 状態を2箇所（列と期限）に持つと必ず食い違うため。
 * 「いま何日目か」は `trial_ends_at` と現在時刻から毎回計算する。
 *
 * ⚠ **トライアル切れと、契約後の未払いはまったく別物。**
 *   - トライアル切れ（一度も払っていない）→ **止める**
 *   - 契約後の未払い（`past_due`）→ **止めない**（運用中の店舗のため）
 *   この関数はトライアルだけを見る。未払いの判定に流用しないこと。
 */

export type TrialPhase =
  /** トライアルとは無関係（運営が手で作った契約先、または契約済み） */
  | "none"
  /** トライアル中。まだ余裕がある */
  | "active"
  /** トライアル中。残りわずか（予告を強める） */
  | "ending"
  /** 期限切れ。サービスを止める */
  | "expired";

export type TrialState = {
  phase: TrialPhase;
  /** 残り日数（切り上げ）。トライアル中でなければ null */
  daysLeft: number | null;
  /** 無料期間の終わり。画面に出す用。トライアルでなければ null */
  endsAt: Date | null;
};

/** この日数を切ったら予告を強める（残り3日で警告色にする） */
export const TRIAL_ENDING_DAYS = 3;

/** 新規登録時に与える無料期間 */
export const TRIAL_DAYS = 14;

const NONE: TrialState = { phase: "none", daysLeft: null, endsAt: null };

/**
 * トライアルの状態を求める。
 *
 * @param trialEndsAt `tenants.trial_ends_at`。null なら運営が手で作った契約先
 * @param hasSubscription Stripe の契約があるか。あればトライアルは終わっている（払っている）
 * @param now 判定の基準時刻。テストから固定値を渡せるようにしてある
 */
export function getTrialState(
  trialEndsAt: string | Date | null,
  hasSubscription: boolean,
  now: Date = new Date(),
): TrialState {
  // 契約済みなら、期限が過去でも止めない。**支払いが済んでいる相手を止めないため**
  if (hasSubscription) return NONE;
  if (!trialEndsAt) return NONE;

  const endsAt = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(endsAt.getTime())) return NONE;

  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) return { phase: "expired", daysLeft: 0, endsAt };

  // 「あと0日」と出さないよう切り上げる（残り3時間でも「あと1日」）
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return { phase: daysLeft <= TRIAL_ENDING_DAYS ? "ending" : "active", daysLeft, endsAt };
}

/** 新規登録時の期限を作る */
export function trialEndsAtFrom(start: Date = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** 「2026年9月7日」の形。画面と通知で表記を揃えるため、ここでだけ整える */
export function formatTrialDate(date: Date): string {
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
