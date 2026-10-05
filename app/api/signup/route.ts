import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validatePassword } from "@/lib/password";
import { TRIAL_DAYS } from "@/lib/billing/trial";
import {
  checkSignupRateLimit,
  hashClientIp,
  recordSignupAttempt,
} from "@/lib/signup/rate-limit";
import { MissingIpSaltError } from "@/lib/ai-check/rate-limit";
// 上限と料金の計算は lib から取る。"use client" の部品から import すると
// サーバー側で実際の値にならず、チェックが素通りする（2026-08-24 実測）
import {
  isValidStoreCount,
  MAX_STORES,
  monthlyYenFor,
  PILOT_MAX_STORES,
  PILOT_STORE_LIMIT_TEXT,
} from "@/lib/signup/plan";
import { sendConfirmationEmail } from "@/lib/signup/confirmation-email";
import { appOrigin } from "@/lib/billing/server";
import { getSignupMode } from "@/lib/signup/mode";
import { INVITE_CODE_UNUSABLE, normalizeInviteCode } from "@/lib/signup/invite-code";
import { consumeInviteCode, releaseInviteCode } from "@/lib/signup/invite";

/**
 * 新規登録（セルフサーブ）。docs/specs/billing.md 5-2。
 *
 * `scripts/create-tenant.mjs` と同じ3つを作る。**順番と後始末も同じ形にしてある。**
 *   1. tenants（契約先。store_quota ＝ 申し込み店舗数、card_required ＝ true）
 *   2. Supabase Auth のユーザー（**app_metadata.tenant_id が RLS の全ての土台**）
 *   3. stores（最初の店舗は作らない。オンボーディングのステップ2で店名を聞くため）
 *
 * ── 招待コード（試験導入＝招待制ベータ。supabase/0018、2026-10-01）──────────
 * 環境変数 SIGNUP_MODE が invite（**未設定も invite**）なら、コードが無いと登録できない。
 * open ならコードは任意。どちらでも、コードを入れたなら使えるコードでなければ通さない
 * （入れたのに黙って通常の申し込みにすると、本人は試験導入のつもりで請求の対象になる）。
 *
 *   - コードは**作る前に1回ぶん確保する**（DB の関数で「確かめて1増やす」を1文で行う）。
 *     途中で失敗したら、後始末で1回ぶんを戻す
 *   - コードで作った契約先は is_pilot = true（試験導入中・無料）。trial_ends_at は入れない
 *     （null ＝「トライアル経由で作られていない契約先」。0014）
 *   - 使えないときの文言は1つ（入力の誤り・期限切れ・使用済み・停止中を区別しない）
 *   - 回数制限は従来どおり。コードの失敗も1回に数える（当てずっぽうの総当たりを止める）
 *
 * ⚠ **service_role で書く。** 契約先がまだ無い段階なので、RLS を通せる主体がいない。
 *   そのぶん、書き込む値はすべてこの中で組み立て、リクエストの値をそのまま使わない。
 *
 * ⚠ **無料体験はここでは始めない**（2026-09-28 天真の決定。docs/specs/billing.md §3）。
 *   14日間は「カードを登録した日から」数える。`trial_ends_at` は空のまま、カードの登録のときに
 *   Stripe の契約の `trial_end` が Webhook 経由で入る。かわりに `card_required = true` を付け、
 *   カードを登録するまで二次元コード・店舗枠の追加・来店客のアンケートを止める（§3-2）。
 *   営業経由（`scripts/create-tenant.mjs`）は付けない＝今までどおり止まらない。
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
  inviteCode?: unknown;
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
  // 招待コード。揺れ（小文字・ハイフンの有無・空白）はここで DB の形にそろえる
  const rawInviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  const inviteCode = rawInviteCode ? normalizeInviteCode(rawInviteCode) : null;

  // 画面と同じ条件をサーバー側でも確かめる。画面のチェックは迂回できるため
  const fieldErrors: Record<string, string> = {};
  if (!rawInviteCode) {
    if (getSignupMode() === "invite") fieldErrors.inviteCode = "入力してください";
  } else if (!inviteCode) {
    fieldErrors.inviteCode = INVITE_CODE_UNUSABLE;
  }
  if (!companyName) fieldErrors.companyName = "入力してください";
  if (!personName) fieldErrors.personName = "入力してください";
  if (!email) fieldErrors.email = "入力してください";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "メールアドレスの形式をご確認ください";
  const passwordError = validatePassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  if (!isValidStoreCount(storeCount)) {
    fieldErrors.storeCount = `店舗数は1〜${MAX_STORES}の範囲でお選びください`;
  } else if (rawInviteCode && storeCount > PILOT_MAX_STORES) {
    // 試験導入は無料なので、選んだ店舗数がそのまま無料の店舗枠になる。
    // 1つのコードで作れる枠に上限を置く（画面のステッパーも同じ上限。迂回されても通さない）
    fieldErrors.storeCount = PILOT_STORE_LIMIT_TEXT;
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
    // 0) 招待コードを1回ぶん確保する（supabase/0018）。**作る前に**行い、だめならここで断る
    let inviteCodeId: string | null = null;
    if (inviteCode) {
      const consumed = await consumeInviteCode(admin, inviteCode);
      if (!consumed.ok) {
        // 問い合わせ自体に失敗した（0018 が未実行など）のは「コードが使えない」とは別。下の 500 に回す
        if (consumed.reason === "unavailable") throw new Error("招待コードを確かめられなかった");
        await recordSignupAttempt(admin, ipHash, false);
        return NextResponse.json(
          { error: INVITE_CODE_UNUSABLE, fieldErrors: { inviteCode: INVITE_CODE_UNUSABLE } },
          { status: 400 },
        );
      }
      const usedId = consumed.inviteCodeId;
      inviteCodeId = usedId;
      undo.push(() => releaseInviteCode(admin, usedId));
    }
    /** 試験導入（招待コードで登録）か。無料なので、トライアルの期限もお支払いの案内も持たせない */
    const pilot = inviteCodeId !== null;

    // 1) 契約先。**申し込んだ店舗数がそのまま枠になる**（supabase/0009）
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: companyName,
        store_quota: storeCount,
        // 試験導入（招待コード）は無料なので、カードの関門をかけない（docs/specs/billing.md §3）
        card_required: !pilot,
        // 0018 の列は試験導入のときだけ書く。コードなしの申し込み（SIGNUP_MODE=open）は 0018 の有無に関係なく動く
        ...(pilot ? { invite_code_id: inviteCodeId, is_pilot: true } : {}),
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
      // 確認リンクを踏むまでログインさせない（2026-08-24 天真の決定）。
      // 捨てアドレスでの無限トライアルを防ぐため。
      // ⚠ createUser 自体はメールを送らない。**この下で確認メールを送っている。**
      email_confirm: false,
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

    // 3) 確認メールを送る
    //
    // `generateLink` は**リンクを作るだけでメールは送らない**（2026-08-24 実測）。
    // Supabase の SMTP 設定は「Supabase が送るメール」にしか効かないため、
    // ここは自分で Resend から送る。
    //
    // メールが送れなくても契約先とユーザーは作れている。ここで巻き戻すと
    // 「登録できていないのにメールアドレスだけ使用済み」という直せない状態になる。
    // 送信の失敗はログに残し、画面には「届かないときは再送できる」と伝える。
    const confirmSent = await sendConfirmationEmail(admin, email!, appOrigin(req), { pilot });

    await recordSignupAttempt(admin, ipHash, true);

    return NextResponse.json({
      ok: true,
      trialDays: TRIAL_DAYS,
      storeCount,
      monthlyYen: monthlyYenFor(storeCount),
      emailSent: confirmSent,
      // 完了画面がトライアルと月額の案内を出すかを決める（試験導入なら出さない）
      pilot,
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
