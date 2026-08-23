"use client";

import { useState } from "react";
import { LoopInput } from "@/components/admin/LoopInput";
import { LoopButton } from "@/components/rating-flow/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * パスワード再設定（Figmaに対応ノード無し。天真確認・案A「1画面完結」で決定 2026-08-06）。
 *
 * メール送信自体はSupabase Auth組み込みのメール送信を使う（Resend等の追加サービスは不要）。
 * 送信後は「ご登録のメールアドレスの場合、再設定用のリンクをお送りしています」に切り替える。
 * 存在しないメールアドレスでも同じ文言にすることで、第三者にアカウントの有無を教えない
 * （Supabase側もresetPasswordForEmailはメール存在の有無に関わらず同じ応答を返す）。
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim() === "") return;
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password/confirm`,
    });
    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <div
        className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[20px] p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="whitespace-nowrap text-xl font-bold tracking-[1.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          GOOD LOOP
        </p>
        <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          パスワードの再設定
        </p>

        {sent ? (
          <>
            <p className="w-full text-center text-[13px] font-medium" style={{ color: "var(--product-color-text-primary)" }}>
              ご登録のメールアドレスの場合、再設定用のリンクをお送りしています。メールをご確認ください。
            </p>
            <a href="/admin/login" className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--loop-accent-primary)" }}>
              ログイン画面に戻る
            </a>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-5">
            <div className="flex w-full flex-col items-start gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                メールアドレス
              </p>
              <LoopInput value={email} onChange={setEmail} type="email" placeholder="temma@yorkys.jp" />
            </div>
            <LoopButton variant="primary" type="submit" disabled={submitting}>
              {submitting ? "送信中…" : "再設定用のリンクを送る"}
            </LoopButton>
            <a href="/admin/login" className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--loop-accent-primary)" }}>
              ログイン画面に戻る
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
