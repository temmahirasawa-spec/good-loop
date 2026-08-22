"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoopInput } from "@/components/admin/LoopInput";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { WithdrawModal } from "@/components/admin/WithdrawModal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { AccountIcon } from "@/components/admin/SettingsMenuIcons";

/** メール・パスワードの「変更」行。クリックすると同じ行内に入力欄が開く（Figmaに個別画面は無い） */
function EditableRow({
  label,
  displayValue,
  fields,
  onSave,
}: {
  label: string;
  displayValue: string;
  fields: { placeholder: string; type: "email" | "password" }[];
  onSave: (values: string[]) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<string[]>(fields.map(() => ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const message = await onSave(values);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setDone(true);
    setEditing(false);
    setValues(fields.map(() => ""));
  }

  return (
    <div className="flex w-full flex-col items-start gap-2">
      {/* SPは値が長いと右端で切れるので、ラベルと値を2行にする（2026-08-22 天真のFigmaコメント） */}
      <div className="flex w-full items-start justify-between gap-3 py-2 md:h-12 md:items-center md:py-0">
        <div className="flex min-w-0 flex-col items-start gap-0.5 md:flex-row md:items-center md:gap-4">
          <p className="text-[12.5px] md:w-[140px] md:shrink-0" style={{ color: "var(--product-color-text-secondary)" }}>
            {label}
          </p>
          <p className="break-all text-[13.5px] md:whitespace-nowrap" style={{ color: "var(--product-color-text-primary)" }}>
            {displayValue}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setDone(false);
            setError(null);
          }}
          className="shrink-0 text-[12.5px]"
          style={{ color: "var(--loop-accent-action)" }}
        >
          {editing ? "キャンセル" : "変更"}
        </button>
      </div>
      {editing && (
        <div className="flex w-full flex-col items-start gap-2 pl-[calc(140px+var(--product-space-16))]">
          {fields.map((f, i) => (
            <LoopInput
              key={f.placeholder}
              value={values[i]}
              onChange={(v) => setValues((prev) => prev.map((x, idx) => (idx === i ? v : x)))}
              type={f.type}
              placeholder={f.placeholder}
            />
          ))}
          {error && (
            <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
              {error}
            </p>
          )}
          <button type="button" onClick={handleSave} disabled={saving} className="text-[12.5px] font-bold" style={{ color: "var(--loop-accent-action)" }}>
            {saving ? "保存中…" : "保存する"}
          </button>
        </div>
      )}
      {done && (
        <p className="pl-[calc(140px+var(--product-space-16))] text-[12px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
          変更しました
        </p>
      )}
    </div>
  );
}

/** 設定（アカウント） Figma node 73:1434 PC / 75:1917 SP */
export function SettingsAccountView({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  async function handleWithdrawConfirm() {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const res = await fetch("/api/admin/settings/withdraw", { method: "POST" });
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.push("/admin/login");
    } catch {
      setWithdrawing(false);
      setWithdrawError("退会処理に失敗しました。もう一度お試しください。");
    }
  }

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <SettingsCardTitle icon={<AccountIcon />}>アカウント</SettingsCardTitle>

        <EditableRow
          label="メールアドレス"
          displayValue={initialEmail}
          fields={[{ placeholder: "新しいメールアドレス", type: "email" }]}
          onSave={async ([nextEmail]) => {
            if (!nextEmail || nextEmail.trim() === "") return "メールアドレスを入力してください";
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ email: nextEmail.trim() });
            if (error) return "変更できませんでした。もう一度お試しください。";
            return null;
          }}
        />

        <EditableRow
          label="パスワード"
          displayValue="••••••••"
          fields={[
            { placeholder: "新しいパスワード（8文字以上）", type: "password" },
            { placeholder: "新しいパスワード（確認）", type: "password" },
          ]}
          onSave={async ([password, confirmPassword]) => {
            if (password.length < 8) return "パスワードは8文字以上で入力してください";
            if (password !== confirmPassword) return "パスワードが一致しません";
            const supabase = createSupabaseBrowserClient();
            const { error } = await supabase.auth.updateUser({ password });
            if (error) return "変更できませんでした。もう一度お試しください。";
            return null;
          }}
        />

        <LogoutButton className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }} />

        <div className="flex w-full flex-col items-start gap-1 border-t pt-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <button type="button" onClick={() => setConfirming(true)} className="text-[12.5px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            退会する
          </button>
          <p className="text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
            回答データ・二次元コードはすべて使えなくなります。手続き前に確認画面を挟みます
          </p>
          {withdrawError && (
            <p className="text-[11px]" style={{ color: "var(--product-color-status-warning)" }}>
              {withdrawError}
            </p>
          )}
        </div>
      </div>

      {confirming && (
        <WithdrawModal
          onClose={() => setConfirming(false)}
          onConfirm={handleWithdrawConfirm}
          confirming={withdrawing}
        />
      )}
    </>
  );
}
