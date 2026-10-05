/**
 * 無料体験の日数と日付の表し方（docs/specs/billing.md §3）。
 *
 * 2026-09-28 から、無料体験は**カードを登録した日から14日間**。
 * 体験の終わりの日は **Stripe の契約の `trial_end` が正**で、Webhook が `tenants.trial_ends_at` に書く。
 * ここはその日付から「残り○日」を出すだけで、期限を自分で決めない（画面の日付と実際の請求日を必ずそろえるため）。
 *
 * サーバーと画面の両方から使うので、秘密の値は持たせない。
 */

/** 無料体験の長さ（Stripe の `trial_period_days` にも同じ値を渡す） */
export const TRIAL_DAYS = 14;

/** この日数を切ったら、カウントダウンを警告の色にする（残り3日から。§3-5） */
export const TRIAL_ENDING_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 体験の残り日数。
 *
 * **切り上げる**：カードを登録した瞬間は「残り14日」、終わりの日の朝は「残り1日」。
 * 「残り0日」とは出さない（終わった時点で Stripe の契約が有料に切り替わり、この表示自体が消える）。
 */
export function trialDaysLeft(trialEndsAt: string | Date | null | undefined, now: Date = new Date()): number | null {
  const end = toDate(trialEndsAt);
  if (!end) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}

/** 体験を始めてから何日目か（登録した日が1日目）。7日目のメールの判定に使う */
export function trialDayNumber(trialEndsAt: string | Date | null | undefined, now: Date = new Date()): number | null {
  const left = trialDaysLeft(trialEndsAt, now);
  if (left === null) return null;
  return TRIAL_DAYS - left + 1;
}

/** 「10月12日」の形（日本時間） */
export function formatMonthDay(value: string | Date): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" });
}

/** 「2026年10月12日」の形（日本時間）。メールと規約まわりで使う */
export function formatTrialDate(value: string | Date): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}
