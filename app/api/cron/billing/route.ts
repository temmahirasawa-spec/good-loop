import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import { trialDayNumber, trialDaysLeft } from "@/lib/billing/trial";
import { sendDeletionNotice, sendTrialDay7 } from "@/lib/billing/notices";

/**
 * お支払いまわりの定期実行（docs/specs/billing.md §8）。Vercel Cron から1日1回（日本時間の昼）呼ばれる。
 *
 * | 仕事 | 条件 |
 * |---|---|
 * | 7日目の「ここまでの結果」のメール | 体験中で、体験の7日目以降（3日前のメールがまだ来ない間） |
 * | データ削除の30日前・7日前のお知らせと、削除 | お休みのあと、最後にログインしてから180日（§3-9） |
 *
 * 3日前のメールは Stripe の知らせ（trial_will_end）で送るので、ここには入れない。
 *
 * ⚠ **外から叩かれても動かないよう、`CRON_SECRET` で守る**（Vercel Cron は `Authorization: Bearer <CRON_SECRET>` を付けて呼ぶ）。
 * ⚠ **データの削除は取り消せない。** `BILLING_DATA_DELETION_ENABLED=true` を入れるまでは、削除も削除の予告も行わず、
 *   対象の数だけをログに出す（テスト用の契約先で何度も確かめてから入れる。§3-9）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
/** お休みのあと、最後のログインから何日でデータを消すか（Q6） */
const DELETE_AFTER_DAYS = 180;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!STRIPE_ENABLED) return NextResponse.json({ skipped: "stripe disabled" });

  const now = new Date();
  const admin = createSupabaseAdminClient();
  const summary = { day7: { sent: 0, skipped: 0, failed: 0 }, deletion: { notices: 0, deleted: 0, dryRun: 0, failed: 0 } };

  // ── 7日目の「ここまでの結果」 ───────────────────────────
  const { data: trialing } = await admin
    .from("tenants")
    .select("id, stripe_customer_id, trial_ends_at")
    .eq("billing_status", "trialing")
    .not("trial_ends_at", "is", null)
    .returns<{ id: string; stripe_customer_id: string | null; trial_ends_at: string }[]>();

  for (const t of trialing ?? []) {
    const day = trialDayNumber(t.trial_ends_at, now);
    const left = trialDaysLeft(t.trial_ends_at, now);
    // 7日目。1日取りこぼしても翌日に送る。ただし3日前のメール（残り3日）が来る日までには送り終える
    if (day === null || left === null || day < 7 || left <= 3) continue;
    try {
      const r = await sendTrialDay7(admin, { tenantId: t.id, customerId: t.stripe_customer_id, trialEndsAt: t.trial_ends_at, now });
      if (r === "sent") summary.day7.sent++;
      else summary.day7.skipped++;
    } catch (error) {
      summary.day7.failed++;
      console.error(`[cron] 7日目のメールに失敗 (${t.id})`, error);
    }
  }

  // ── お休みが続いた契約先のデータ削除（§3-9） ─────────────────
  const deletionEnabled = process.env.BILLING_DATA_DELETION_ENABLED === "true";
  const { data: paused } = await admin
    .from("tenants")
    .select("id, stripe_customer_id, billing_ended_at")
    .eq("billing_status", "canceled")
    .not("billing_ended_at", "is", null)
    .returns<{ id: string; stripe_customer_id: string | null; billing_ended_at: string }[]>();

  if ((paused ?? []).length > 0) {
    const lastLogin = await lastSignInByTenant(admin);
    for (const t of paused ?? []) {
      // 数え始めは「お休みになった日」と「最後にログインした日」の遅いほう。ログインすれば数え直す（Q6）
      const base = Math.max(new Date(t.billing_ended_at).getTime(), lastLogin.get(t.id) ?? 0);
      const deleteOn = new Date(base + DELETE_AFTER_DAYS * DAY_MS);
      const daysUntil = Math.ceil((deleteOn.getTime() - now.getTime()) / DAY_MS);
      if (daysUntil > 30) continue;

      if (!deletionEnabled) {
        summary.deletion.dryRun++;
        console.log(`[cron] 削除の対象（未実行）: ${t.id} 予定日 ${deleteOn.toISOString().slice(0, 10)}（あと${daysUntil}日）`);
        continue;
      }

      try {
        if (daysUntil > 0) {
          const kind = daysUntil > 7 ? "deletion_30d" : "deletion_7d";
          const r = await sendDeletionNotice(admin, { tenantId: t.id, customerId: t.stripe_customer_id, kind, deleteOn: deleteOn.toISOString() });
          if (r === "sent") summary.deletion.notices++;
          continue;
        }
        await deleteResponseData(admin, t.id);
        summary.deletion.deleted++;
      } catch (error) {
        summary.deletion.failed++;
        console.error(`[cron] データ削除の処理に失敗 (${t.id})`, error);
      }
    }
  }

  console.log("[cron] billing", JSON.stringify(summary));
  return NextResponse.json(summary);
}

/** 契約先ごとの、最後にログインした日時（ミリ秒）。ユーザーの app_metadata.tenant_id でまとめる */
async function lastSignInByTenant(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`ユーザーの一覧を取得できない: ${error.message}`);
    for (const u of data.users) {
      const tenantId = u.app_metadata?.tenant_id as string | undefined;
      if (!tenantId || !u.last_sign_in_at) continue;
      out.set(tenantId, Math.max(out.get(tenantId) ?? 0, new Date(u.last_sign_in_at).getTime()));
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

/**
 * 回答と集計の元データを消す（Q6）。**アカウント・契約先・店舗・アンケートの項目は残す。**
 *
 * survey_responses を消すと、回答のタグ（response_tags）・Google への送客の記録（conversion_events）・
 * 下書きの記録は `on delete cascade` で一緒に消える（supabase/0001・0004）。読み取りの記録（page_views）は別に消す。
 * 消す前に数を記録する（あとから「何を消したか」を追えるように）。
 */
async function deleteResponseData(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string): Promise<void> {
  const [responses, views] = await Promise.all([
    admin.from("survey_responses").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("page_views").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  console.log(`[cron] データ削除: ${tenantId} 回答 ${responses.count ?? 0}件・読み取り ${views.count ?? 0}件`);

  const r1 = await admin.from("survey_responses").delete().eq("tenant_id", tenantId);
  if (r1.error) throw new Error(`回答の削除に失敗: ${r1.error.message}`);
  const r2 = await admin.from("page_views").delete().eq("tenant_id", tenantId);
  if (r2.error) throw new Error(`読み取りの記録の削除に失敗: ${r2.error.message}`);
}
