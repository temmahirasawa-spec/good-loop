import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 通知設定の保存（supabase/0015、2026-08-24）。
 *
 * **店舗ごとの設定。** 低評価は「その店の問題」なので、店長に直接届いて
 * その場で手を打てるほうがよい（天真の決定）。
 *
 * ⚠ **ログイン中のセッションで書き込む**（service_role を使わない）。
 *   RLS（supabase/0002「stores: tenant isolation」）がそのまま効くので、
 *   他のテナントの店舗を書き換えることが構造的にできない。
 *   店舗IDをリクエストから受け取っても安全なのはこのため。
 */

type Body = { storeId?: unknown; notifyLowRating?: unknown; notifyEmail?: unknown };

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.storeId !== "string" || typeof body.notifyLowRating !== "boolean") {
    return NextResponse.json({ error: "入力を読み取れませんでした。" }, { status: 400 });
  }

  const raw = typeof body.notifyEmail === "string" ? body.notifyEmail.trim() : "";
  // 空欄は「通知しない」の意思表示。null で保存する（空文字だと宛先として扱われかねない）
  const notifyEmail = raw === "" ? null : raw;
  if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
    return NextResponse.json(
      { error: "メールアドレスの形式をご確認ください", fieldErrors: { notifyEmail: "メールアドレスの形式をご確認ください" } },
      { status: 400 },
    );
  }
  // 宛先が無いのに通知を on にすると、送れないのに送る設定になる。画面と同じ条件で弾く
  if (body.notifyLowRating && !notifyEmail) {
    return NextResponse.json(
      { error: "通知先のメールアドレスをご入力ください", fieldErrors: { notifyEmail: "通知を受け取るには入力が必要です" } },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("stores")
    .update({ notify_low_rating: body.notifyLowRating, notify_email: notifyEmail })
    .eq("id", body.storeId);

  if (error) {
    console.error("[notifications] 保存に失敗", error);
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
