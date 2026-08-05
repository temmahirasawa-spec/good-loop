"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WithdrawModal } from "@/components/admin/WithdrawModal";

/**
 * 設定（アカウント） Figma node 73:1434 PC / 75:1917 SP。
 *
 * メール・パスワードの「変更」、「ログアウト」はSupabase Authが無いため未接続。
 * 退会確認モーダルの実装が主目的（Figma node 75:1449 / 76:1736）。
 */
export default function SettingsAccountPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          アカウント
        </p>

        <div className="flex h-12 w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="w-[140px] text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
              メールアドレス
            </p>
            <p className="whitespace-nowrap text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
              temma.hirasawa@gmail.com
            </p>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
            変更
          </p>
        </div>

        <div className="flex h-12 w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="w-[140px] text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
              パスワード
            </p>
            <p className="text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
              ••••••••
            </p>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
            変更
          </p>
        </div>

        <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
          ログアウト
        </p>

        <div className="flex w-full flex-col items-start gap-1 border-t pt-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <button type="button" onClick={() => setConfirming(true)} className="text-[12.5px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            退会する
          </button>
          <p className="text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
            回答データ・二次元コードはすべて使えなくなります。手続き前に確認画面を挟みます
          </p>
        </div>
      </div>

      {confirming && (
        <WithdrawModal
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            router.push("/admin/login");
          }}
        />
      )}
    </>
  );
}
