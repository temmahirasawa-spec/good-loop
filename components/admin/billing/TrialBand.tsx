"use client";

import { ReviewButton } from "@/components/rating-flow/Button";
import { useCardGate } from "@/components/admin/billing/CardGate";
import { TRIAL_DAYS, TRIAL_ENDING_DAYS } from "@/lib/billing/trial";

/**
 * トップの帯（無料体験 A案。Figma App Design Master `12 無料体験 / Trial` のトップ4状態）。
 *
 * | 状態 | 帯 |
 * |---|---|
 * | trial | 「無料体験 残り○日（○月○日まで）」＋14日のめもり。**残り3日から警告の色**（§3-5） |
 * | cancel | 「解約の手続きが済んでいます。○月○日までお使いいただけます。」（§13） |
 * | paused | お休み。見るだけ。「カードを登録する」（§3-8） |
 */
export type TrialBandProps =
  | { kind: "trial"; daysLeft: number; endLabel: string }
  | { kind: "cancel"; cancelLabel: string; daysLeft: number | null }
  | { kind: "paused" };

export function TrialBand(props: TrialBandProps) {
  const gate = useCardGate();

  if (props.kind === "paused") {
    return (
      <div className="flex w-full shrink-0 flex-col gap-3 rounded-2xl px-4 py-4 md:gap-2 md:px-6" style={{ backgroundColor: "var(--product-color-status-error-subtle)" }}>
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-bold" style={{ color: "var(--product-color-status-error)" }}>
              アンケートはお休み中です。
            </p>
            <p className="text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
              カードを登録すると再開できます。これまでのデータは、そのまま残っています。
            </p>
          </div>
          <div className="w-full md:w-[220px] md:shrink-0">
            <ReviewButton variant="primary" onClick={gate.startRegistration}>
              カードを登録する
            </ReviewButton>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
          これまでの回答と集計はご覧いただけます。設定の変更・店舗の追加・卓上POPの発行は、カードのご登録後にご利用いただけます
        </p>
      </div>
    );
  }

  const daysLeft = props.daysLeft;
  const warn = props.kind === "trial" && props.daysLeft <= TRIAL_ENDING_DAYS;
  return (
    <div
      className="flex w-full shrink-0 flex-col items-start gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-5"
      style={{ backgroundColor: warn ? "var(--product-color-secondary-tint)" : "var(--product-color-surface-white)" }}
    >
      {props.kind === "trial" ? (
        <p className="text-[15px] leading-snug md:text-base">
          <span className="font-bold" style={{ color: warn ? "var(--product-color-status-warning)" : "var(--review-accent-primary)" }}>
            無料体験{" "}
          </span>
          <span className="font-bold" style={{ color: warn ? "var(--product-color-status-warning)" : "var(--product-color-text-primary)" }}>
            残り{daysLeft}日
          </span>
          <span style={{ color: "var(--product-color-text-secondary)" }}>（{props.endLabel}まで）</span>
        </p>
      ) : (
        <p className="text-[15px] font-bold leading-snug md:text-base" style={{ color: "var(--product-color-text-primary)" }}>
          解約の手続きが済んでいます。{props.cancelLabel}までお使いいただけます。
        </p>
      )}
      {daysLeft !== null && <DayMeter daysLeft={daysLeft} warn={warn} />}
    </div>
  );
}

/** 14日のめもり。経過した日を塗る（登録した日は「残り14日」＝0個） */
function DayMeter({ daysLeft, warn }: { daysLeft: number; warn: boolean }) {
  const done = Math.min(TRIAL_DAYS, Math.max(0, TRIAL_DAYS - daysLeft));
  return (
    <div className="flex w-full shrink-0 gap-1 md:w-auto" aria-hidden>
      {Array.from({ length: TRIAL_DAYS }, (_, i) => (
        <span
          key={i}
          className="h-2 flex-1 rounded-full md:w-5 md:flex-none"
          style={{ backgroundColor: i < done ? (warn ? "var(--product-color-status-warning)" : "var(--review-accent-primary)") : "var(--product-color-bg-tertiary)" }}
        />
      ))}
    </div>
  );
}
