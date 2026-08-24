import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { TRIAL_DAYS } from "@/lib/billing/trial";

/**
 * 新規登録の確認メール（2026-08-24）。
 *
 * ⚠ **`generateLink` はリンクを作るだけで、メールは送らない**（実測で確認）。
 *   Supabase の SMTP 設定は「Supabase が自分で送るメール」にしか効かないため、
 *   ここは自分で Resend から送る。
 *
 * ⚠ **リンクは本人以外に渡らないようにすること。** このリンクを開いた人が
 *   そのアカウントにログインできる。ログにも画面にも出さない。
 */
export async function sendConfirmationEmail(
  admin: SupabaseClient,
  email: string,
  origin: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    // generateLink には password が要る。ユーザーは作成済みなので、
    // ここで渡した値は使われない（リンクの生成にのみ必要）
    password: crypto.randomUUID(),
    options: { redirectTo: `${origin}/admin` },
  });

  const link = data?.properties?.action_link;
  if (error || !link) {
    console.error("[signup] 確認リンクの生成に失敗", error);
    return false;
  }

  const result = await sendEmail({
    to: email,
    subject: "【GOOD REVIEW】メールアドレスのご確認をお願いします",
    text: [
      "GOOD REVIEW にお申し込みいただき、ありがとうございます。",
      "",
      "下のリンクを開くと、ご利用を開始できます。",
      "",
      link,
      "",
      `無料期間は${TRIAL_DAYS}日間です。期間中にやめていただければ、費用は一切かかりません。`,
      "カードのご登録は、期限までに管理画面の「設定 ＞ お支払い」からお願いします。",
      "",
      "───────────────",
      "このメールにお心当たりがない場合は、お手数ですが破棄してください。",
      "リンクを開かないかぎり、ご利用が始まることはありません。",
      "",
      "株式会社UTUTU / GOOD REVIEW",
    ].join("\n"),
  });

  return result.ok;
}
