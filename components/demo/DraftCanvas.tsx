"use client";

import { useEffect, useRef, useState } from "react";
import { AiSparkleIcon } from "@/components/rating-flow/icons";
import type { MaterialChip } from "@/lib/demo/fact-model";

/**
 * 感想の器（docs/specs/survey-v2.md §13、2026-08-28 の連続インタビュー化）。
 *
 * **体験の主役。** 質問フォームと同じかそれ以上に重要な領域として扱う。
 *
 * 4つの状態:
 *   ・Empty     … まだ何も選んでいない（80〜96px）
 *   ・Material  … 選んだ断片をチップで見せる（140〜180px）。**不自然な仮文は出さない**
 *   ・Writing   … 「AIが言葉を整えています」。**Materialは消さない**（180〜220px）
 *   ・Resting   … 検証済みの文章へ atomic swap（160〜190px）
 *   ・Expanded  … タップで全文（画面高の40〜55%）
 *
 * 未検証のstreamは表示しない（呼び出し側が検証してから text を渡す契約）。
 */

/** 表示の速さ（文字/ms）。溜まっているぶんが多いほど速く出す */
function speedFor(remaining: number): number {
  if (remaining > 160) return 0.35;
  if (remaining > 80) return 0.16;
  if (remaining > 30) return 0.09;
  return 0.055;
}

export function DraftCanvas({
  text,
  chips,
  busy,
  freshText,
  freshChips,
  chipZoneRef,
  expanded,
  onToggle,
  emptyHint,
}: {
  /** 検証済みの文章だけ */
  text: string;
  /** まだ文章になっていない断片 */
  chips: MaterialChip[];
  /** AI整文中か */
  busy: boolean;
  /** 直近で言葉になった部分（イエローの下線が左→右に走る） */
  freshText: string;
  /** 直近に届いた語句（到着した瞬間だけ淡く光る） */
  freshChips: string[];
  /** chip が並ぶ場所。ここへ選択肢を吸い込む（親が座標を取るための ref） */
  chipZoneRef: React.RefObject<HTMLDivElement>;
  expanded: boolean;
  onToggle: () => void;
  emptyHint: string;
}) {
  const { shown } = useTypewriter(text);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [highlightOn, setHighlightOn] = useState(false);

  // 「今この言葉になった」ときだけ、短くイエローを走らせる
  useEffect(() => {
    if (!freshText) return;
    setHighlightOn(true);
    const timer = setTimeout(() => setHighlightOn(false), 1100);
    return () => clearTimeout(timer);
  }, [freshText]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, chips.length]);

  const hasContent = shown !== "" || chips.length > 0;
  const minHeight = expanded ? "45dvh" : !hasContent ? 80 : busy ? 180 : shown ? 160 : 140;
  const maxHeight = expanded ? "55dvh" : !hasContent ? 96 : busy ? 220 : shown ? 190 : 180;

  // 新しく言葉になった部分だけを下線で示す（帯ではなく、走る下線）
  const freshIndex = highlightOn && freshText ? shown.indexOf(freshText) : -1;
  const before = freshIndex >= 0 ? shown.slice(0, freshIndex) : shown;
  const fresh = freshIndex >= 0 ? shown.slice(freshIndex, freshIndex + freshText.length) : "";
  const after = freshIndex >= 0 ? shown.slice(freshIndex + freshText.length) : "";

  return (
    <div
      className="pointer-events-auto relative flex w-full flex-col rounded-t-[var(--product-radius-lg)] border-t-[1.5px] border-solid px-[var(--product-space-20)] pb-[var(--product-space-12)] pt-[var(--product-space-4)] transition-[min-height,max-height] duration-300"
      style={{
        minHeight,
        maxHeight,
        // すりガラス。色はトークンから作る（生の色コードは書かない）
        backgroundColor: "color-mix(in srgb, var(--product-color-surface-white) 72%, transparent)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderColor: "color-mix(in srgb, var(--review-accent-primary) 55%, transparent)",
        boxShadow: "0 -10px 30px color-mix(in srgb, var(--product-color-text-primary) 8%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--review-accent-primary) 70%, transparent), transparent)",
        }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex h-9 w-full shrink-0 items-center justify-between gap-[var(--product-space-8)]"
      >
        <span className="flex items-center gap-[var(--product-space-8)]">
          <AiSparkleIcon className="size-[15px] shrink-0" />
          <span className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
            {busy ? "AIが言葉を整えています" : "あなたの感想"}
          </span>
          {busy ? (
            <span className="flex items-center gap-[3px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="review-pulse size-[5px] rounded-[var(--product-radius-full)]"
                  style={{ backgroundColor: "var(--review-accent-primary)", animationDelay: `${i * 160}ms` }}
                />
              ))}
            </span>
          ) : null}
        </span>
        {hasContent ? (
          <span className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {expanded ? "閉じる" : "全文を見る"}
          </span>
        ) : null}
      </button>

      <div ref={bodyRef} className="flex w-full flex-1 flex-col gap-[var(--product-space-8)] overflow-y-auto">
        {shown ? (
          <p
            className="w-full overflow-hidden text-[15px] leading-[1.9]"
            style={{
              color: "var(--product-color-text-primary)",
              // 文章は最大4行（続きは「全文を見る」で）
              display: expanded ? "block" : "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: expanded ? "unset" : 4,
            }}
          >
            {before}
            {fresh ? <span className="review-underline">{fresh}</span> : null}
            {after}
          </p>
        ) : null}

        {/* まだ文章になっていない断片。整文中も消さない */}
        {chips.length > 0 ? (
          <div
            ref={chipZoneRef}
            className="flex w-full flex-wrap items-center gap-[var(--product-space-4)] overflow-hidden"
            // タグは最大2行（新しいものが左上に来る）
            style={{ maxHeight: expanded ? undefined : 56 }}
          >
            {[...chips].reverse().map((chip) => (
              <span
                key={chip.id}
                className={`review-rise flex items-center rounded-[var(--product-radius-full)] px-[var(--product-space-8)] py-[2px] text-[13px] font-bold ${
                  freshChips.includes(chip.label) ? "review-flash" : ""
                }`}
                style={{
                  backgroundColor: freshChips.includes(chip.label)
                    ? undefined
                    : chip.lead
                      ? "var(--review-accent-wash)"
                      : chip.polarity === "negative"
                        ? "var(--product-color-status-warning-wash)"
                        : "var(--product-color-bg-tertiary)",
                  color: chip.lead
                    ? "var(--review-accent-primary)"
                    : chip.polarity === "negative"
                      ? "var(--product-color-status-warning)"
                      : "var(--product-color-text-secondary)",
                }}
              >
                {chip.lead ? "" : "＋ "}
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}

        {!hasContent ? (
          <p ref={chipZoneRef as unknown as React.RefObject<HTMLParagraphElement>} className="text-[15px] leading-[1.9]" style={{ color: "var(--product-color-text-muted)" }}>
            {emptyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 文字を1つずつ出す。**受信（不均一）と表示（等速）を切り離す**ための部品。
 * `requestAnimationFrame` を使うのは、setTimeout の発火ムラがそのまま
 * 文字の出方のムラになるため（2026-08-28 天真の指摘で変更）。
 */
export function useTypewriter(text: string, options?: { instant?: boolean }) {
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(false);
  const shownRef = useRef("");

  useEffect(() => {
    if (options?.instant) {
      shownRef.current = text;
      setShown(text);
      setBusy(false);
      return;
    }
    if (text === shownRef.current) {
      setBusy(false);
      return;
    }
    if (!text.startsWith(shownRef.current)) {
      // 入れ替わった（整文で丸ごと差し替わった）→ 演出せず即座に反映
      shownRef.current = text;
      setShown(text);
      setBusy(false);
      return;
    }

    setBusy(true);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      if (last === 0) last = now;
      const elapsed = now - last;
      last = now;
      const remaining = text.length - shownRef.current.length;
      const advance = Math.max(1, Math.round(elapsed * speedFor(remaining)));
      const next = text.slice(0, Math.min(text.length, shownRef.current.length + advance));
      shownRef.current = next;
      setShown(next);
      if (next.length >= text.length) {
        setBusy(false);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [text, options?.instant]);

  return { shown, busy };
}
