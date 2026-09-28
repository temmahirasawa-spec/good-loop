import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";

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
      // 2026-09-28 から、無料体験はカードを登録した日から数える（docs/specs/billing.md §13）
      "アンケートの項目や業態テーマは、このまま設定できます。お店で使い始めるときに、お支払いのカードを登録してください。無料体験の14日間はその日から数えます。",
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
