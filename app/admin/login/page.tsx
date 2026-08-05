"use client";

import { useState } from "react";
import { LoopInput } from "@/components/admin/LoopInput";
import { LoopButton } from "@/components/rating-flow/Button";

/**
 * ログイン（Figma node 81:1812 PC / 81:1846 SP、エラー版 81:1828 / 81:1862）。
 *
 * `(dashboard)` ルートグループの外に置き、サイドバーを持たない単独ページにしてある
 * （app/admin/layout.tsx はもう存在しない。app/admin/(dashboard)/layout.tsx がダッシュボード側だけを包む）。
 *
 * Supabase Authがまだ無いため、実際の認証はしていない。未入力のまま送信したときの
 * エラー表示（Figmaの2案）だけを、素直なクライアント側バリデーションとして実装した。
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: Supabase Auth が入ったら signInWithPassword に置き換える
    setShowError(email.trim() === "" || password.trim() === "");
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

        <LoopButton variant="primary" type="submit">
          ログイン
        </LoopButton>

        <button type="button" className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--loop-accent-action)" }}>
          パスワードをお忘れの方はこちら
        </button>
      </form>
    </div>
  );
}
