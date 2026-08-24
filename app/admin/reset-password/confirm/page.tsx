"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { ReviewButton } from "@/components/rating-flow/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PASSWORD_PLACEHOLDER, PASSWORD_RULE_TEXT, validatePassword } from "@/lib/password";

/**
 * パスワード再設定・確認（Figmaに対応ノード無し。天真確認・案A決定 2026-08-06）。
 *
 * メールのリンクから遷移してくる。Supabaseのブラウザクライアントが起動時にURLの
 * recoveryトークンを検出して一時セッションを張る（`createBrowserClient` 既定の
 * `detectSessionInUrl: true`）。リンクの有効期限切れ・無効な場合はセッションが無いため
 * エラー文言を出す。
 */
export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setInvalid(!data.session);
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 決まりごとは lib/password.ts に集約する（画面ごとに条件を書かない）
    const invalid = validatePassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError("パスワードを変更できませんでした。もう一度お試しください。");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/admin"), 1500);
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <div
        className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[20px] p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="whitespace-nowrap text-xl font-bold tracking-[1.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          GOOD REVIEW
        </p>
        <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          新しいパスワードを設定
        </p>

        {!ready && (
          <p className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            確認しています…
          </p>
        )}

        {ready && invalid && (
          <>
            <p className="w-full text-center text-[13px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
              リンクの有効期限が切れているか、無効です。もう一度お試しください。
            </p>
            <a href="/admin/reset-password" className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--review-accent-primary)" }}>
              パスワード再設定をやり直す
            </a>
          </>
        )}

        {ready && !invalid && done && (
          <p className="w-full text-center text-[13px] font-medium" style={{ color: "var(--product-color-text-primary)" }}>
            パスワードを変更しました。管理画面に移動します…
          </p>
        )}

        {ready && !invalid && !done && (
          <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-5">
            {error && (
              <div className="flex w-full flex-col items-start rounded-xl p-3" style={{ backgroundColor: "var(--product-color-status-warning-wash)" }}>
                <p className="w-full text-[12.5px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
                  {error}
                </p>
              </div>
            )}
            <div className="flex w-full flex-col items-start gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                新しいパスワード
              </p>
              <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                {PASSWORD_RULE_TEXT}
              </p>
              <ReviewInput value={password} onChange={setPassword} type="password" placeholder={PASSWORD_PLACEHOLDER} />
            </div>
            <div className="flex w-full flex-col items-start gap-2">
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                新しいパスワード（確認）
              </p>
              <ReviewInput value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="もう一度入力してください" />
            </div>
            <ReviewButton variant="primary" type="submit" disabled={submitting}>
              {submitting ? "変更中…" : "パスワードを変更する"}
            </ReviewButton>
          </form>
        )}
      </div>
    </div>
  );
}
