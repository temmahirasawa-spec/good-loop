"use client";

import { useState } from "react";
import { Toggle } from "@/components/admin/Toggle";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { ReviewButton } from "@/components/rating-flow/Button";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { NotificationIcon } from "@/components/admin/SettingsMenuIcons";

/**
 * 設定（通知） Figma node 73:1329 PC / 75:1752 SP の表示部分。
 *
 * 2026-08-24、**低評価アラートを実際に動かせるようにした**（supabase/0015）。
 * 通知は**店舗ごと**の設定（天真の決定）。低評価は「その店の問題」なので、
 * 店長に直接届いてその場で手を打てるほうがよい。
 *
 * 「新しいGoogleレビュー」は2026-08-05に削除済み（Google側の件数を取得できないため）。
 *
 * ⚠ 読み取り急減・送客率の低下は、**毎日決まった時刻に判定する仕組み（cron）が要る**ので
 *   まだ動かせない。押せる状態にすると「設定したのに来ない」になるため、
 *   触れないようにして理由を書いてある。
 */
export function SettingsNotificationsView({
  storeId,
  storeName,
  initialNotifyLowRating,
  initialNotifyEmail,
}: {
  storeId: string;
  storeName: string;
  initialNotifyLowRating: boolean;
  initialNotifyEmail: string;
}) {
  const [lowRating, setLowRating] = useState(initialNotifyLowRating);
  const [email, setEmail] = useState(initialNotifyEmail);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = lowRating !== initialNotifyLowRating || email !== initialNotifyEmail;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings/notifications", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storeId, notifyLowRating: lowRating, notifyEmail: email }),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "保存できませんでした。もう一度お試しください。");
      }
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
    }
    setSaving(false);
  }

  return (
    <div className="flex w-full flex-col items-start gap-2 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <SettingsCardTitle icon={<NotificationIcon />}>通知</SettingsCardTitle>

      {/* 低評価アラート（動く） */}
      <div className="flex w-full items-center justify-between gap-6 py-4">
        <div className="flex flex-1 flex-col items-start gap-1">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            低評価アラート
          </p>
          <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: "var(--product-color-text-secondary)" }}>
            ★3以下の回答が入った瞬間に、{storeName} のご担当者さまへメールでお知らせします
          </p>
        </div>
        <Toggle
          checked={lowRating}
          onChange={(v) => {
            setLowRating(v);
            setSaved(false);
          }}
          label="低評価アラート"
        />
      </div>

      {/* まだ動かせない2つ。触れないようにして理由を書く */}
      {[
        { label: "二次元コードの読み取り急減", description: "読み取りが前週の半分を下回ったらお知らせします（置き場所の異変に気づけます）" },
        { label: "送客率の低下", description: "Googleへの送客率が大きく下がったらお知らせします" },
      ].map((alert) => (
        <div
          key={alert.label}
          className="flex w-full items-center justify-between gap-6 py-4"
          style={{ borderTop: "1px solid var(--product-color-border-divider)" }}
        >
          <div className="flex flex-1 flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold" style={{ color: "var(--product-color-text-muted)" }}>
                {alert.label}
              </p>
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: "var(--product-color-bg-secondary)", color: "var(--product-color-text-secondary)" }}
              >
                準備中
              </span>
            </div>
            <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: "var(--product-color-text-muted)" }}>
              {alert.description}
            </p>
          </div>
          <Toggle checked={false} onChange={() => {}} label={alert.label} disabled />
        </div>
      ))}

      <div className="flex w-full flex-col items-start gap-2 pt-2">
        <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          通知先メールアドレス
        </p>
        <ReviewInput
          value={email}
          onChange={(v) => {
            setEmail(v);
            setSaved(false);
          }}
          type="email"
          placeholder="tencho@example.com"
          className="!h-11"
        />
        <p className="text-[11px] font-medium" style={{ color: "var(--product-color-text-muted)" }}>
          ログインに使うメールアドレスとは別に設定できます（店長さま宛など）
        </p>
      </div>

      {error && (
        <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
          {error}
        </p>
      )}

      {/* PCは右寄せ（2026-08-23、Figmaコメント 1895968371）。SPは従来どおり左 */}
      <div className="flex w-full flex-col items-start gap-2 pt-2 md:items-end">
        <ReviewButton variant="primary" disabled={saving || !dirty} onClick={save}>
          {saving ? "保存中..." : "保存する"}
        </ReviewButton>
        {saved && (
          <p className="text-[11px] font-medium" style={{ color: "var(--review-accent-primary)" }}>
            保存しました
          </p>
        )}
      </div>
    </div>
  );
}
