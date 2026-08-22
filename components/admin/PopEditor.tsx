"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";
import { PopSheet } from "@/components/admin/PopSheet";
import { POP_PRESETS, POP_QR_SIZES, presetOf } from "@/lib/admin/pop";

/**
 * 卓上POPを作る（Figma `Modal / 卓上POPを作る — PC` / `卓上POPを作る — SP 390`）。
 *
 * 2026-08-22、天真のFigmaコメント：
 *   「QRはこの3つをプリセットにして、そのプリセットを選んだら内容を自由に編集できるようにしたい。
 *     QRのサイズ、文字の内容などです。」
 *   「ここは5行ぐらい入るように。1.カメラでコード....の文章をプレースホルダーに。」
 *
 * デザインを選ぶと、見出しと本文はそのプリセットの文言に**入力欄のプレースホルダーとして**出る。
 * 何も打たなければプリセットの文言がそのまま印刷される（＝空欄でも成立する）。
 */

const DEFAULT_ERROR = "保存できませんでした。もう一度お試しください。";

export function PopEditor({
  storeId,
  storeName,
  qrSvg,
  initial,
}: {
  storeId: string;
  storeName: string;
  qrSvg: string;
  initial: { preset: string; heading: string; note: string; qrSize: string };
}) {
  const [preset, setPreset] = useState(initial.preset);
  const [heading, setHeading] = useState(initial.heading);
  const [note, setNote] = useState(initial.note);
  const [qrSize, setQrSize] = useState(initial.qrSize);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = presetOf(preset);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/pop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, preset, heading, note, qrSize }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : DEFAULT_ERROR);
      }
    } catch {
      setError(DEFAULT_ERROR);
    }
    setSaving(false);
  }

  const previewContent = {
    storeName,
    preset,
    heading: heading.trim() || current.heading,
    note: note.trim() === "" ? current.note : note,
    qrSize,
    qrSvg,
  };

  return (
    <div className="flex w-full flex-col items-start gap-5 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        卓上POPを作る
      </p>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        デザインを選んで、文字とQRの大きさを変えられます。印刷はA6（105×148mm）です
      </p>

      <div className="flex w-full flex-col items-start gap-6 md:flex-row">
        {/* プレビュー。SPでは先に見せる */}
        <div className="order-1 flex w-full flex-col items-start gap-2 md:order-2 md:w-auto">
          <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
            プレビュー
          </p>
          <div
            className="flex w-full justify-center rounded-2xl p-5"
            style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
          >
            <div className="origin-top scale-[0.62] md:scale-100" style={{ height: "92mm" }}>
              <div className="rounded-lg border" style={{ borderColor: "var(--product-color-border-divider)" }}>
                <PopSheet content={previewContent} />
              </div>
            </div>
          </div>
        </div>

        <div className="order-2 flex w-full flex-col items-start gap-5 md:order-1 md:w-[340px]">
          <div className="flex w-full flex-col items-start gap-2">
            <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
              デザイン
            </p>
            <div className="flex w-full gap-2">
              {POP_PRESETS.map((p) => {
                const on = p.code === preset;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setPreset(p.code)}
                    className="flex flex-1 flex-col items-start gap-1 rounded-xl border p-3 text-left"
                    style={{
                      backgroundColor: on ? "var(--loop-accent-wash)" : "var(--product-color-surface-white)",
                      borderColor: on ? "var(--loop-accent-primary)" : "var(--product-color-border-default)",
                      borderWidth: on ? 2 : 1,
                    }}
                  >
                    <span className="text-[12.5px] font-bold" style={{ color: on ? "var(--loop-accent-action)" : "var(--product-color-text-primary)" }}>
                      {p.label}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
              見出し
            </p>
            <LoopInput value={heading} onChange={setHeading} placeholder={current.heading} />
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
              本文（改行できます）
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={current.note}
              rows={5}
              className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none"
              style={{
                borderColor: "var(--product-color-border-default)",
                backgroundColor: "var(--product-color-surface-white)",
                color: "var(--product-color-text-primary)",
              }}
            />
          </div>

          <div className="flex w-full flex-col items-start gap-2">
            <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
              QRの大きさ
            </p>
            <div className="flex gap-2">
              {POP_QR_SIZES.map((s) => {
                const on = s.code === qrSize;
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setQrSize(s.code)}
                    className="flex min-h-11 items-center rounded-full px-5"
                    style={{
                      backgroundColor: on ? "var(--loop-accent-wash)" : "transparent",
                      border: on ? "none" : "1px solid var(--product-color-border-default)",
                      color: on ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)",
                      fontWeight: on ? 700 : 400,
                    }}
                  >
                    <span className="text-[12.5px]">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
              {error}
            </p>
          )}

          <div className="flex w-full flex-col gap-2 md:flex-row">
            <LoopButton variant="outline" disabled={saving} onClick={save}>
              {saving ? "保存中…" : saved ? "保存しました" : "保存する"}
            </LoopButton>
            <LoopButton variant="primary" onClick={() => window.open(`/admin/pop/${storeId}`, "_blank")}>
              印刷する
            </LoopButton>
          </div>
        </div>
      </div>
    </div>
  );
}
