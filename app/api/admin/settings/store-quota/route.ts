import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { BILLING } from "@/lib/admin/constants";
import { isValidStoreCount } from "@/lib/signup/plan";

/**
 * 店舗枠の追加申し込み（設定・お支払い、2026-08-21）。
 *
 * Stripe がまだ未接続のため、ここは**決済ではなく申し込みの記録**（supabase/0011）。
 * 運営（天真）が入金を確認して tenants.store_quota を増やすと、店舗を追加できるようになる。
 *
 * Stripe をつないだら、このルートを「決済セッションを作る」処理に差し替える。
 * そのとき store_quota_requests は不要になる。
 */

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const quota = await getStoreQuotaState();
  if (quota.quota === null) {
    // 枠が読み取れていない状態で申し込むと、記録される数字が事実と食い違う
    return NextResponse.json({ error: "店舗枠を取得できませんでした。時間をおいてお試しください。" }, { status: 503 });
  }
  if (quota.hasPendingRequest) {
    return NextResponse.json({ error: "すでに申し込み済みです。担当者からのご連絡をお待ちください。" }, { status: 409 });
  }

  // 希望の枠数（ステッパー化・2026-08-25）。指定が無ければ従来どおり +1
  const body = (await request.json().catch(() => null)) as { desiredQuota?: unknown } | null;
  const desired = body?.desiredQuota === undefined ? quota.quota + 1 : Number(body.desiredQuota);
  if (!isValidStoreCount(desired) || desired === quota.quota) {
    return NextResponse.json({ error: "店舗枠の値をご確認ください。" }, { status: 400 });
  }
  if (desired < quota.used) {
    return NextResponse.json(
      { error: `いま${quota.used}店舗をお使いのため、${quota.used}店舗より少なくはできません。` },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("store_quota_requests").insert({
    tenant_id: tenantId,
    current_quota: quota.quota,
    requested_quota: desired,
    monthly_yen: BILLING.additionalStoreMonthlyYen,
  });

  if (error) {
    return NextResponse.json({ error: "申し込めませんでした。もう一度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
