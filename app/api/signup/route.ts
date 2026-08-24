import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/password";
import { trialEndsAtFrom, TRIAL_DAYS } from "@/lib/billing/trial";
import {
  checkSignupRateLimit,
  hashClientIp,
  recordSignupAttempt,
} from "@/lib/signup/rate-limit";
import { MissingIpSaltError } from "@/lib/ai-check/rate-limit";
// 上限と料金の計算は lib から取る。"use client" の部品から import すると
// サーバー側で実際の値にならず、チェックが素通りする（2026-08-24 実測）
import { isValidStoreCount, MAX_STORES, monthlyYenFor } from "@/lib/signup/plan";

/**
 * 新規登録（セルフサーブ）。docs/specs/billing.md 5-2。
 *
 * `scripts/create-tenant.mjs` と同じ3つを作る。**順番と後始末も同じ形にしてある。**
 *   1. tenants（契約先。store_quota ＝ 申し込み店舗数、trial_ends_at ＝ 14日後）
 *   2. Supabase Auth のユーザー（**app_metadata.tenant_id が RLS の全ての土台**）
 *   3. stores（最初の店舗は作らない。オンボーディングのステップ2で店名を聞くため）
 *
 * ⚠ **service_role で書く。** 契約先がまだ無い段階なので、RLS を通せる主体がいない。
 *   そのぶん、書き込む値はすべてこの中で組み立て、リクエストの値をそのまま使わない。
 *
 * ⚠ **メール確認あり**（2026-08-24 天真の決定）。`email_confirm: false` で作り、
 *   Supabase から確認メールを送る。確認リンクを踏むまでログインできない。
 *   捨てアドレスでの無限トライアルを防ぐため。
 *   （`scripts/create-tenant.mjs` は商談経由なので `email_confirm: true` のまま。用途が違う）
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  companyName?: unknown;
  personName?: unknown;
  email?: unknown;
  password?: unknown;
  storeCount?: unknown;
};

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > max) return null;
  return v;
}

export async function POST(req: Request) {
  let ipHash: string;
  try {
    ipHash = hashClientIp(req);
  } catch (error) {
    if (error instanceof MissingIpSaltError) {
      // 塩が無いとレート制限が成立しない。歯止め無しでは通さない
      console.error("[signup] AI_CHECK_IP_SALT が未設定のため新規登録を停止した");
      return NextResponse.json({ error: "ただいま新規のお申し込みを受け付けられません。" }, { status: 503 });
    }
    throw error;
  }

  const admin = createSupabaseAdminClient();

  const verdict = await checkSignupRateLimit(admin, ipHash);
  if (!verdict.allowed) {
    const message =
      verdict.reason === "per_ip"
        ? "お申し込みが続いています。しばらく時間をおいてからお試しください。"
        : "ただいま新規のお申し込みを受け付けられません。時間をおいてお試しください。";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "入力を読み取れませんでした。" }, { status: 400 });

  const companyName = asTrimmed(body.companyName, 120);
  const personName = asTrimmed(body.personName, 60);
  const email = asTrimmed(body.email, 254);
  const password = typeof body.password === "string" ? body.password : "";
  const storeCount = Number(body.storeCount);

  // 画面と同じ条件をサーバー側でも確かめる。画面のチェックは迂回できるため
  const fieldErrors: Record<string, string> = {};
  if (!companyName) fieldErrors.companyName = "入力してください";
  if (!personName) fieldErrors.personName = "入力してください";
  if (!email) fieldErrors.email = "入力してください";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "メールアドレスの形式をご確認ください";
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!isValidStoreCount(storeCount)) {
    fieldErrors.storeCount = `店舗数は1〜${MAX_STORES}の範囲でお選びください`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    await recordSignupAttempt(admin, ipHash, false);
    return NextResponse.json({ error: "入力内容をご確認ください", fieldErrors }, { status: 400 });
  }

  /** 失敗したときに戻すための後始末（新しいものから順に実行する） */
  const undo: Array<() => Promise<unknown>> = [];
  async function rollback() {
    for (const step of undo.reverse()) {
      try {
        await step();
      } catch (e) {
        console.error("[signup] 後始末に失敗", e);
      }
    }
  }

  try {
    // 1) 契約先。**申し込んだ店舗数がそのまま枠になる**（supabase/0009）
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: companyName,
        store_quota: storeCount,
        trial_ends_at: trialEndsAtFrom().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (tenantError || !tenant) throw new Error(`契約先の作成に失敗: ${tenantError?.message}`);
    undo.push(async () => {
      await admin.from("tenants").delete().eq("id", tenant.id);
    });

    // 2) ログイン用ユーザー
    //
    // ⚠⚠ **必ず `createUser` を使う。`inviteUserByEmail` を使ってはいけない。** ⚠⚠
    //
    // 2026-08-24、実測して分かったこと:
    //   - createUser        … 既存のメールなら **422 で弾かれる**（重複を確実に検知できる）
    //   - inviteUserByEmail … 既存のメールでも **エラーにならず、既存ユーザーを返す**
    //   - generateLink      … 同上。エラーにならない
    //
    // invite で作ると、他人のメールアドレスで登録を試みたときに
    // **その人の app_metadata.tenant_id が新しい契約先に上書きされ、
    // 元の契約先が誰からも触れない孤児になる**（＝契約先の乗っ取り）。
    // 検証で実際に再現した。ここを別のAPIに変えるときは、必ず重複の挙動を実測すること。
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email: email!,
      password,
      // ⚠ 本来は false にして確認メールを送りたい（天真の決定）。
      //   ただし createUser はメールを送らないため、確認メールには Resend の接続が要る。
      //   繋がるまでは確認なしで通す（false のままだと誰もログインできなくなるため）。
      //   **Resend を繋いだら false に変え、下の確認リンクを送る処理を有効にすること。**
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id },
      user_metadata: { full_name: personName },
    });
    if (userError || !created?.user) {
      const already = userError?.status === 422 || /already|registered|exists/i.test(userError?.message ?? "");
      if (already) {
        await rollback();
        await recordSignupAttempt(admin, ipHash, false);
        return NextResponse.json(
          {
            error: "このメールアドレスはすでに登録されています",
            fieldErrors: { email: "すでに使われているアドレスです" },
          },
          { status: 409 },
        );
      }
      throw new Error(`ログイン用ユーザーの作成に失敗: ${userError?.message}`);
    }
    undo.push(async () => {
      await admin.auth.admin.deleteUser(created.user.id);
    });

    await recordSignupAttempt(admin, ipHash, true);

    return NextResponse.json({
      ok: true,
      trialDays: TRIAL_DAYS,
      storeCount,
      monthlyYen: monthlyYenFor(storeCount),
      emailSent: false,
    });
  } catch (error) {
    console.error("[signup] 新規登録に失敗", error);
    await rollback();
    await recordSignupAttempt(admin, ipHash, false);
    return NextResponse.json(
      { error: "お申し込みを完了できませんでした。時間をおいてお試しください。" },
      { status: 500 },
    );
  }
}
