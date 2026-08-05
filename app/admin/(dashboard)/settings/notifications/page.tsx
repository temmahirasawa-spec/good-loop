"use client";

import { useState } from "react";
import { Toggle } from "@/components/admin/Toggle";
import { LoopInput } from "@/components/admin/LoopInput";

type AlertKey = "lowRating" | "qrDrop" | "routeRateDrop";

const ALERTS: { key: AlertKey; label: string; description: string }[] = [
  { key: "lowRating", label: "低評価アラート", description: "★3以下の回答が入った瞬間にメールでお知らせします" },
  { key: "qrDrop", label: "二次元コードの読み取り急減", description: "読み取りが前週の半分を下回ったらお知らせします（置き場所の異変に気づけます）" },
  { key: "routeRateDrop", label: "送客率の低下", description: "Googleへの送客率が大きく下がったらお知らせします" },
];

/**
 * 設定（通知） Figma node 73:1329 PC / 75:1752 SP。
 *
 * 「新しいGoogleレビュー」の項目は2026-08-05に削除した（docs/specs/launch-plan.md ①参照。
 * Google側の実際のレビュー件数はGOOD LOOPから取得できないため）。
 * メール送信の実装（Resend）はまだ無いため、トグルの状態はローカルのみ。
 */
export default function SettingsNotificationsPage() {
  const [alerts, setAlerts] = useState<Record<AlertKey, boolean>>({ lowRating: true, qrDrop: true, routeRateDrop: false });
  const [email, setEmail] = useState("temma@yorkys.jp");

  return (
    <div className="flex w-full flex-col items-start gap-2 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        通知
      </p>
      {ALERTS.map((alert, i) => (
        <div
          key={alert.key}
          className="flex w-full items-center justify-between gap-6 py-4"
          style={i > 0 ? { borderTop: "1px solid var(--product-color-border-divider)" } : undefined}
        >
          <div className="flex flex-1 flex-col items-start gap-1">
            <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {alert.label}
            </p>
            <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: "var(--product-color-text-secondary)" }}>
              {alert.description}
            </p>
          </div>
          <Toggle checked={alerts[alert.key]} onChange={(v) => setAlerts((prev) => ({ ...prev, [alert.key]: v }))} label={alert.label} />
        </div>
      ))}
      <div className="flex w-full flex-col items-start gap-2">
        <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          通知先メールアドレス
        </p>
        <LoopInput value={email} onChange={setEmail} type="email" className="!h-11" />
      </div>
    </div>
  );
}
