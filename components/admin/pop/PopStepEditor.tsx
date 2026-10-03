"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { Toggle } from "@/components/admin/Toggle";
import { useCardGate } from "@/components/admin/billing/CardGate";
import { PopCard, type PopCardContent } from "@/components/admin/pop/PopCard";
import { PopPrintSheet } from "@/components/admin/pop/PopPrintSheet";
import {
  POP_COLORS,
  POP_DEFAULT_HEADING,
  POP_DEFAULT_NOTE,
  POP_DESIGNS,
  POP_MAX_HEADING,
  POP_MAX_NOTE,
  POP_ORIENTATIONS,
  POP_QR_SIZES,
  type PopSettings,
} from "@/lib/admin/pop";
import { PAUSED_EDIT_MESSAGE } from "@/lib/billing/messages";

/**
 * 卓上POPを作る（名刺サイズ・案3 ステップ）。Figma App Design Master「13 卓上POP / 名刺サイズ（案3 ステップ）」。
 * 2026-09-29、天真が3案から「案3（ステップで進める）」を選んだ。
 *
 * ① 向き → ② デザインと色 → ③ 文字とロゴ → ④ 印刷。どの段でも右（スマホは上）に仕上がりを出す。
 * 保存は ④ の「保存して印刷する」でまとめて行う（途中の段で保存しない＝途中でやめても前の設定のまま）。
 *
 * - 印刷はカードを登録してから（無料体験 A案。docs/specs/billing.md §3-2）。押した操作は関門のモーダルへ
 * - お休み中は見るだけ（§3-8）。サーバーも保存を 403 で断る
 * - お店のロゴがオンで未登録なら「ロゴアップロード画面から先に登録してください」（天真の文）。印刷は店名の文字になる
 */

const STEPS = ["向き", "デザインと色", "文字とロゴ", "印刷"] as const;
const NEXT_LABEL = ["次へ（デザインと色）", "次へ（文字とロゴ）", "次へ（印刷）", "保存して印刷する"] as const;
const BACK_LABEL = ["", "← 向きに戻る", "← デザインに戻る", "← 文字とロゴに戻る"] as const;
const DEFAULT_ERROR = "保存できませんでした。もう一度お試しください。";

const PRINT_NOTES = [
  "市販の A4 名刺用紙（10面・91×55mm）に、10枚まとめて印刷します。",
  "印刷の画面で、倍率を「100%」（実際のサイズ）にしてください。",
  "縦のデザインは、用紙の上では横に倒して並びます。切り離せば縦で置けます。",
];

export function PopStepEditor({
  storeId,
  storeName,
  logoUrl,
  qrSvg,
  initial,
  paused,
  initialStep = 1,
  initialError = null,
}: {
  storeId: string;
  storeName: string;
  logoUrl: string | null;
  /** カードを登録する前・お休みのあいだは null（鍵の絵を出す） */
  qrSvg: string | null;
  initial: PopSettings;
  paused: boolean;
  /** 検証用ページ（/demo/pop）で途中の段・保存の失敗を見せるためだけに使う */
  initialStep?: number;
  initialError?: string | null;
}) {
  const gate = useCardGate();
  const [step, setStep] = useState(initialStep);
  const [s, setS] = useState<PopSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const set = <K extends keyof PopSettings>(k: K, v: PopSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const content: PopCardContent = { ...s, storeName, logoUrl, qrSvg };

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/pop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, ...s }),
      });
      if (res.ok) return true;
      const data = await res.json().catch(() => null);
      setError(typeof data?.error === "string" ? data.error : DEFAULT_ERROR);
      return false;
    } catch {
      setError(DEFAULT_ERROR);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function saveAndPrint() {
    gate.requireCard(() => {
      // 保存を待ってから開くと、ブラウザがポップアップとして止めることがある。先に空のタブを開いておく
      const tab = window.open("", "_blank");
      void save().then((ok) => {
        if (!tab) return;
        if (ok) tab.location.href = `/admin/pop/${storeId}`;
        else tab.close();
      });
    });
  }

  function next() {
    if (step < 4) {
      setError(null);
      setStep(step + 1);
      return;
    }
    saveAndPrint();
  }

  const logoMissing = s.showStoreLogo && !logoUrl;

  return (
    <div className="flex w-full flex-col items-start gap-4 md:gap-6">
      {paused && (
        <div className="w-full rounded-xl px-4 py-3" style={{ backgroundColor: "var(--product-color-status-error-subtle)" }}>
          <p className="text-[13px]" style={{ color: "var(--product-color-status-error)" }}>
            {PAUSED_EDIT_MESSAGE}
          </p>
        </div>
      )}

      <StepBar step={step} onJump={(n) => n < step && setStep(n)} />

      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* 仕上がり。スマホでは先に見せる */}
        <section className="order-1 flex w-full flex-col gap-3 rounded-2xl p-4 md:order-2 md:flex-1 md:gap-4 md:p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
          <p className="hidden text-base font-bold md:block" style={{ color: "var(--product-color-text-primary)" }}>
            プレビュー
          </p>
          <div className="flex w-full items-center justify-center rounded-2xl p-3 md:p-10" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
            {step === 4 ? (
              <div className="shadow-md [--pop-u:0.2088px] md:[--pop-u:0.4377px]">
                <PopPrintSheet content={content} unit="var(--pop-u)" />
              </div>
            ) : (
              <div
                className={`shadow-md ${s.orientation === "landscape" ? "[--pop-u:0.808px] md:[--pop-u:1.154px]" : "[--pop-u:0.682px] md:[--pop-u:1.364px]"}`}
              >
                <PopCard content={content} unit="var(--pop-u)" />
              </div>
            )}
          </div>
        </section>

        <section className="order-2 flex w-full flex-col gap-5 rounded-2xl p-5 md:order-1 md:w-[560px] md:shrink-0 md:p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
          {step === 1 && (
            <Group title="向きを選ぶ">
              <div className="grid w-full grid-cols-2 gap-3">
                {POP_ORIENTATIONS.map((o) => (
                  <Choice key={o.code} on={s.orientation === o.code} disabled={paused} label={o.label} onClick={() => set("orientation", o.code)}>
                    <Thumb content={{ ...content, orientation: o.code, design: "simple" }} />
                  </Choice>
                ))}
              </div>
            </Group>
          )}

          {step === 2 && (
            <>
              <Group title="デザインを選ぶ">
                <div className="grid w-full grid-cols-2 gap-3">
                  {POP_DESIGNS.map((d) => (
                    <Choice key={d.code} on={s.design === d.code} disabled={paused} label={d.label} onClick={() => set("design", d.code)}>
                      <Thumb content={{ ...content, design: d.code }} />
                    </Choice>
                  ))}
                </div>
              </Group>
              <Group title="色">
                <div className="flex flex-wrap gap-1">
                  {POP_COLORS.map((c) => {
                    const on = s.color === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        disabled={paused}
                        aria-label={c.label}
                        aria-pressed={on}
                        onClick={() => set("color", c.slug)}
                        className="grid size-11 place-items-center rounded-full disabled:opacity-40"
                      >
                        <span
                          className="block size-8 rounded-full"
                          style={{
                            backgroundColor: c.swatchPrimary,
                            boxShadow: on ? "0 0 0 2px var(--product-color-surface-white), 0 0 0 4px var(--product-color-text-primary)" : undefined,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </Group>
            </>
          )}

          {step === 3 && (
            <Group title="文字とロゴを入れる">
              <Field label="見出し">
                <ReviewInput value={s.heading} onChange={(v) => !paused && set("heading", v.slice(0, POP_MAX_HEADING))} placeholder={POP_DEFAULT_HEADING} />
              </Field>
              <Field label="ひとこと">
                <ReviewInput value={s.note} onChange={(v) => !paused && set("note", v.slice(0, POP_MAX_NOTE))} placeholder={POP_DEFAULT_NOTE} />
              </Field>
              <Field label="QRの大きさ">
                <div className="flex">
                  {POP_QR_SIZES.map((q) => {
                    const on = s.qrSize === q.code;
                    return (
                      <button
                        key={q.code}
                        type="button"
                        disabled={paused}
                        onClick={() => set("qrSize", q.code)}
                        className="flex h-11 w-11 items-center justify-center border-b-2 text-[13px]"
                        style={{
                          borderColor: on ? "var(--review-accent-primary)" : "transparent",
                          color: on ? "var(--review-accent-primary)" : "var(--product-color-text-secondary)",
                          fontWeight: on ? 700 : 400,
                        }}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="flex w-full flex-col gap-3">
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                    お店のロゴ
                  </p>
                  <Toggle checked={s.showStoreLogo} onChange={(v) => set("showStoreLogo", v)} label="お店のロゴ" disabled={paused} />
                </div>
                {logoMissing && (
                  <div className="flex w-full flex-col gap-1 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--product-color-secondary-tint)" }}>
                    <p className="text-[13px]" style={{ color: "var(--product-color-text-primary)" }}>
                      ロゴアップロード画面から先に登録してください
                    </p>
                    <Link href={`/admin/settings/brand?store=${storeId}`} className="text-[12.5px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
                      ブランドとテーマで登録する →
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-1">
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                    GOOD REVIEW のロゴ
                  </p>
                  <Toggle checked={s.showBrandLogo} onChange={(v) => set("showBrandLogo", v)} label="GOOD REVIEW のロゴ" disabled={paused} />
                </div>
                <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
                  いちばん下の中央に小さく入ります
                </p>
              </div>
            </Group>
          )}

          {step === 4 && (
            <Group title="印刷する">
              {error && (
                <div className="w-full rounded-xl px-4 py-3" style={{ backgroundColor: "var(--product-color-status-error-subtle)" }}>
                  <p className="text-[13px]" style={{ color: "var(--product-color-status-error)" }}>
                    {error}
                  </p>
                </div>
              )}
              <ol className="flex w-full flex-col gap-3">
                {PRINT_NOTES.map((n, i) => (
                  <li key={n} className="text-[13px] leading-[1.7] md:text-sm" style={{ color: "var(--product-color-text-secondary)" }}>
                    {i + 1}. {n}
                  </li>
                ))}
              </ol>
            </Group>
          )}
        </section>
      </div>

      <div className="flex w-full flex-col items-center gap-3 md:flex-row-reverse md:justify-between md:rounded-2xl md:bg-[var(--product-color-surface-white)] md:px-6 md:py-4">
        <div className="w-full md:w-[220px]">
          <ReviewButton variant="primary" disabled={paused || saving} onClick={next}>
            {saving ? "保存中…" : NEXT_LABEL[step - 1]}
          </ReviewButton>
        </div>
        {step > 1 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="flex min-h-11 items-center text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            {BACK_LABEL[step - 1]}
          </button>
        ) : (
          <span className="hidden md:block" />
        )}
      </div>
    </div>
  );
}

/** ① 向き ─ ② デザインと色 ─ ③ 文字とロゴ ─ ④ 印刷。済んだ段は ✓、押すとその段へ戻れる */
function StepBar({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <ol className="flex w-full items-start justify-between rounded-2xl px-3 py-3 md:items-center md:justify-start md:gap-4 md:px-6 md:py-4" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const cur = n === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-4 md:flex-none">
            <button
              type="button"
              onClick={() => onJump(n)}
              disabled={!done}
              aria-current={cur ? "step" : undefined}
              className="flex w-full flex-col items-center gap-1 md:w-auto md:flex-row md:gap-2"
            >
              <span
                className="grid size-7 place-items-center rounded-full text-[13px] font-bold"
                style={{
                  backgroundColor: done ? "var(--review-accent-primary)" : cur ? "var(--product-color-surface-white)" : "var(--product-color-bg-tertiary)",
                  border: cur ? "2px solid var(--review-accent-primary)" : "none",
                  color: done ? "var(--review-accent-on-primary)" : cur ? "var(--review-accent-primary)" : "var(--product-color-text-tertiary)",
                }}
              >
                {done ? "✓" : n}
              </span>
              <span
                className="whitespace-nowrap text-[11px] md:text-sm"
                style={{ color: cur || done ? "var(--product-color-text-primary)" : "var(--product-color-text-tertiary)", fontWeight: cur || done ? 700 : 400 }}
              >
                {label}
              </span>
            </button>
            {n < STEPS.length && (
              <span className="hidden h-0.5 w-10 md:block" style={{ backgroundColor: done ? "var(--review-accent-primary)" : "var(--product-color-border-divider)" }} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Choice({ on, disabled, label, onClick, children }: { on: boolean; disabled: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="flex w-full flex-col items-center gap-2 rounded-xl p-3"
      style={{
        backgroundColor: on ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
        border: on ? "2px solid var(--review-accent-primary)" : "1px solid var(--product-color-border-default)",
      }}
    >
      <div className="grid h-[76px] w-full place-items-center md:h-[122px]">{children}</div>
      <span className="text-[12.5px] md:text-[13px]" style={{ color: on ? "var(--review-accent-primary)" : "var(--product-color-text-secondary)", fontWeight: on ? 700 : 400 }}>
        {label}
      </span>
    </button>
  );
}

/** 候補の小さな見本。横は幅、縦は高さを枠に合わせる */
function Thumb({ content }: { content: PopCardContent }) {
  const land = content.orientation === "landscape";
  return (
    <div className={`shadow-sm ${land ? "[--pop-u:0.33px] md:[--pop-u:0.55px]" : "[--pop-u:0.209px] md:[--pop-u:0.335px]"}`}>
      <PopCard content={content} unit="var(--pop-u)" />
    </div>
  );
}
