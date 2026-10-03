import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { getStripe } from "@/lib/billing/stripe";
import { getTrialResults, type TrialResults } from "@/lib/billing/results";
import { formatMonthDay, trialDaysLeft, TRIAL_DAYS } from "@/lib/billing/trial";
import { formatYen } from "@/lib/admin/constants";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * お支払いまわりのお知らせのメール（docs/specs/billing.md §3-6・§3-9・§13）。
 *
 * | 種類 | いつ | 送る仕組み |
 * |---|---|---|
 * | trial_day7 | 体験の7日目 | 定期実行（app/api/cron/billing） |
 * | trial_will_end | 体験が終わる3日前 | Stripe の `customer.subscription.trial_will_end` |
 * | deletion_30d / deletion_7d | データ削除の30日前・7日前 | 定期実行 |
 * | data_deleted | データを削除したとき | 定期実行 |
 *
 * **同じメールを2回送らない。** 定期実行も Stripe の通知も、同じ知らせが2回来ることがある。
 * 送る前に「送った記録」（supabase/0017 の billing_notices。契約先・種類・ref の組で1回だけ）を書き、
 * 書けたときだけ送る。送れなかったら記録を消して、次の機会にもう一度送れるようにする。
 *
 * 宛先は Stripe の顧客のメール（カードを登録した人のアドレス）。お支払いの連絡先なので、ここに送る。
 */

export type NoticeKind = "trial_day7" | "trial_will_end" | "deletion_30d" | "deletion_7d" | "data_deleted";

/** 記録を書けたら true（＝まだ送っていない）。すでにあれば false */
async function claimNotice(admin: SupabaseClient, tenantId: string, kind: NoticeKind, ref: string): Promise<boolean> {
  const { data, error } = await admin
    .from("billing_notices")
    .upsert({ tenant_id: tenantId, kind, ref }, { onConflict: "tenant_id,kind,ref", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`billing_notices の記録に失敗: ${error.message}`);
  return (data ?? []).length > 0;
}

async function releaseNotice(admin: SupabaseClient, tenantId: string, kind: NoticeKind, ref: string): Promise<void> {
  await admin.from("billing_notices").delete().eq("tenant_id", tenantId).eq("kind", kind).eq("ref", ref);
}

/** 記録してから送る。送れなかったら記録を消して、例外で知らせる（呼び出し側が再送の判断をする） */
async function sendOnce(
  admin: SupabaseClient,
  params: { tenantId: string; kind: NoticeKind; ref: string; to: string; subject: string; text: string },
): Promise<"sent" | "already_sent"> {
  const fresh = await claimNotice(admin, params.tenantId, params.kind, params.ref);
  if (!fresh) return "already_sent";
  const result = await sendEmail({ to: params.to, subject: params.subject, text: params.text });
  if (!result.ok) {
    await releaseNotice(admin, params.tenantId, params.kind, params.ref);
    throw new Error(`お知らせのメールを送れなかった（${params.kind}）: ${result.error}`);
  }
  return "sent";
}

export async function billingEmailOf(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  const customer = await getStripe().customers.retrieve(customerId);
  return "email" in customer ? customer.email ?? null : null;
}

// ── 本文 ─────────────────────────────────────────────

const FOOTER = ["───────────────", "株式会社UTUTU / GOOD REVIEW"];

function resultLines(since: string, r: TrialResults): string[] {
  return [
    `ここまでの結果（${formatMonthDay(since)}から）`,
    `・読み取られた数：${r.scans}回`,
    `・回答の数：${r.responses}件`,
    `・Googleの投稿画面を開いた数：${r.openedGoogle}回`,
    `・お店にだけ届いた声：${r.storeOnly}件`,
    "※Googleの数は、投稿画面を開いた数です。実際に投稿された数ではありません。",
  ];
}

/** 7日目の「ここまでの結果」（§13） */
export async function sendTrialDay7(
  admin: SupabaseClient,
  t: { tenantId: string; customerId: string | null; trialEndsAt: string; now?: Date },
): Promise<"sent" | "already_sent" | "no_address"> {
  const to = await billingEmailOf(t.customerId);
  if (!to) return "no_address";
  const since = new Date(new Date(t.trialEndsAt).getTime() - TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results = await getTrialResults(admin, t.tenantId, since);
  const left = trialDaysLeft(t.trialEndsAt, t.now) ?? 0;
  return sendOnce(admin, {
    tenantId: t.tenantId,
    kind: "trial_day7",
    ref: t.trialEndsAt.slice(0, 10),
    to,
    subject: "【GOOD REVIEW】無料体験のここまでの結果",
    text: [
      `GOOD REVIEW の無料体験は、残り${left}日です（${formatMonthDay(t.trialEndsAt)}まで）。`,
      "",
      ...resultLines(since, results),
      "",
      "くわしくは管理画面でご覧いただけます。",
      `${PUBLIC_APP_URL}/admin`,
      "",
      ...FOOTER,
    ].join("\n"),
  });
}

/** 体験が終わる3日前（Stripe の trial_will_end で送る。§13） */
export async function sendTrialWillEnd(
  admin: SupabaseClient,
  t: { tenantId: string; customerId: string | null; trialStart: string; trialEndsAt: string; monthlyTotal: number },
): Promise<"sent" | "already_sent" | "no_address"> {
  const to = await billingEmailOf(t.customerId);
  if (!to) return "no_address";
  const results = await getTrialResults(admin, t.tenantId, t.trialStart);
  const end = formatMonthDay(t.trialEndsAt);
  return sendOnce(admin, {
    tenantId: t.tenantId,
    kind: "trial_will_end",
    ref: t.trialEndsAt.slice(0, 10),
    to,
    subject: `【GOOD REVIEW】無料体験は${end}で終わります`,
    text: [
      `GOOD REVIEW の無料体験は、${end}で終わります。`,
      "",
      `${end}から、月額${formatYen(t.monthlyTotal)}（税込）のお支払いが始まります。`,
      "続けない場合は、設定＞お支払いから解約してください。体験の最終日までお使いいただけます。",
      `${PUBLIC_APP_URL}/admin/settings/billing`,
      "",
      ...resultLines(t.trialStart, results),
      "",
      ...FOOTER,
    ].join("\n"),
  });
}

/** データ削除の前のお知らせ（30日前・7日前。§3-9・§13） */
export async function sendDeletionNotice(
  admin: SupabaseClient,
  t: { tenantId: string; customerId: string | null; kind: "deletion_30d" | "deletion_7d"; deleteOn: string },
): Promise<"sent" | "already_sent" | "no_address"> {
  const to = await billingEmailOf(t.customerId);
  if (!to) return "no_address";
  const date = formatMonthDay(t.deleteOn);
  return sendOnce(admin, {
    tenantId: t.tenantId,
    kind: t.kind,
    ref: t.deleteOn.slice(0, 10),
    to,
    subject: `【GOOD REVIEW】${date}にデータを削除します`,
    text: [
      "GOOD REVIEW のご契約が終わってから、しばらく管理画面へのログインがありません。",
      `このままご利用が無い場合、${date}に次のデータを削除します。`,
      "",
      "・削除するもの：アンケートの回答と、集計の元になる記録（読み取り・Googleへの送客）",
      "・残るもの：アカウント、店舗、アンケートの項目などの設定",
      "",
      "続けてお使いになる場合は、ログインしてカードを登録してください。同じ二次元コードのまま再開できます。",
      `${PUBLIC_APP_URL}/admin/settings/billing`,
      "",
      ...FOOTER,
    ].join("\n"),
  });
}
