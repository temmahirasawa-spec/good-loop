"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoopInput } from "@/components/admin/LoopInput";
import { LoopButton } from "@/components/rating-flow/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * ログイン（Figma node 81:1812 PC / 81:1846 SP、エラー版 81:1828 / 81:1862）。
 *
 * `(dashboard)` ルートグループの外に置き、サイドバーを持たない単独ページにしてある
 * （app/admin/layout.tsx はもう存在しない。app/admin/(dashboard)/layout.tsx がダッシュボード側だけを包む）。
 *
 * Figmaのエラー文言は「メールアドレスまたはパスワードが正しくありません」の1種類のみ
 * （未入力・認証失敗を区別しない）。Supabase Authのエラーもこの文言に丸めている。
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim() === "" || password.trim() === "") {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    setShowError(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setShowError(true);
      setSubmitting(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-[20px] p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="whitespace-nowrap text-xl font-bold tracking-[1.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          GOOD LOOP
        </p>
        <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          管理画面にログイン
        </p>

        {showError && (
          <div className="flex w-full flex-col items-start rounded-xl p-3" style={{ backgroundColor: "var(--product-color-status-warning-wash)" }}>
            <p className="w-full text-[12.5px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
              メールアドレスまたはパスワードが正しくありません
            </p>
          </div>
        )}

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            メールアドレス
          </p>
          <LoopInput value={email} onChange={setEmail} type="email" placeholder="temma@yorkys.jp" error={showError} />
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            パスワード
          </p>
          <LoopInput value={password} onChange={setPassword} type="password" placeholder="••••••••" error={showError} />
        </div>

        <LoopButton variant="primary" type="submit" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </LoopButton>

        <a href="/admin/reset-password" className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--loop-accent-action)" }}>
          パスワードをお忘れの方はこちら
        </a>
      </form>
    </div>
  );
}
