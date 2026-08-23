"use client";

import { useEffect, useState } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { SAMPLE_QUESTIONS } from "@/lib/ai-check/questions";
import {
  MAX_AREA_LENGTH,
  MAX_GENRE_LENGTH,
  MAX_STORE_NAME_LENGTH,
} from "@/lib/ai-check/sanitize";
import type { CheckInput } from "@/lib/ai-check/types";
import { Card, Eyebrow } from "./Card";
import { usePrefersReducedMotion } from "./hooks";

/**
 * 01 入力画面（docs/prototypes/ai-visibility-checker.html の #scr-input）。
 *
 * 入力欄は既存の `ReviewInput`、主ボタンは既存の `ReviewButton variant="primary"` を使う。
 * `ReviewInput` は id を受け取らないため、ラベルで入力欄を包んでいる
 * （こうするとラベルをタップしても入力欄にフォーカスが移る）。
 */

const TICKER_INTERVAL_MS = 3200;

/**
 * 文字数の上限を state 側で抑える。
 *
 * ⚠ input の `maxLength` 属性は使わない。**属性で止めると、キーボード以外の経路
 *   （貼り付け・自動入力・自動テスト）で入力欄の値と React の state がずれることがある**
 *   （2026-08-17、Playwright の fill で実測）。
 *   state を正にして切り詰めれば、どの経路でも確実に上限が効く。
 *   なお本当の防御はサーバー側（lib/ai-check/sanitize.ts）。ここは親切のため。
 */
function cap(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

const STEPS = [
  { no: "01", title: "AIに質問", body: "エリア×ジャンルの現実的な質問を、実際にAIへ投げます。" },
  { no: "02", title: "回答を照合", body: "AIの回答にあなたの店名（表記ゆれ含む）が登場するか解析します。" },
  { no: "03", title: "スコア化", body: "登場率と順位からAI視認性スコアを算出し、要因を診断します。" },
];

export function InputScreen({
  value,
  onChange,
  onSubmit,
}: {
  value: CheckInput;
  onChange: (next: CheckInput) => void;
  onSubmit: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => {
      setTickerIndex((current) => (current + 1) % SAMPLE_QUESTIONS.length);
    }, TICKER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <div className="w-full">
      {/* ── ヒーロー ─────────────────────────────── */}
      <div className="pb-[var(--product-space-24)] pt-[var(--product-space-40)] md:pt-[var(--product-space-48)]">
        <Eyebrow>AIはあなたのお店を知っていますか</Eyebrow>

        <h1
          className="mt-[var(--product-space-12)] font-bold leading-[1.35] tracking-[0.4px]"
          style={{ fontSize: "clamp(27px, 6.6vw, 40px)", color: "var(--product-color-text-primary)" }}
        >
          あなたのお店、
          <br />
          AIに聞くと出てきますか？
        </h1>

        <p
          className="mt-[var(--product-space-12)] max-w-[34em] text-sm leading-[1.9]"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          「三宮 ランチ おすすめ」— お客様はもう、検索ではなくAIにこう尋ねています。実際にAIへ質問を投げて、あなたのお店が推薦されるかを無料でチェックします。
        </p>

        <div
          className="mt-[var(--product-space-16)] flex min-h-[22px] flex-wrap items-center gap-[var(--product-space-8)] text-[12.5px]"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          <span
            className={`size-[7px] shrink-0 rounded-[var(--product-radius-full)] ${reduced ? "" : "animate-pulse"}`}
            style={{ backgroundColor: "var(--review-accent-primary)" }}
            aria-hidden
          />
          <span>いま試されている質問:</span>
          <b className="font-medium" style={{ color: "var(--product-color-text-primary)" }}>
            {SAMPLE_QUESTIONS[tickerIndex]}
          </b>
        </div>
      </div>

      {/* ── 入力フォーム ─────────────────────────── */}
      <Card className="p-[var(--product-space-20)] md:p-[var(--product-space-24)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Eyebrow>Free Check</Eyebrow>

          <div className="mt-[var(--product-space-12)] grid grid-cols-1 gap-[var(--product-space-12)] md:grid-cols-2">
            <label className="flex flex-col gap-[var(--product-space-8)] md:col-span-2">
              <span className="text-[12.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                店名
                <span className="ml-[var(--product-space-4)] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                  必須
                </span>
              </span>
              <ReviewInput
                value={value.storeName}
                onChange={(storeName) => onChange({ ...value, storeName: cap(storeName, MAX_STORE_NAME_LENGTH) })}
                placeholder="例: まちかど食堂 ひなた"
              />
            </label>

            <label className="flex flex-col gap-[var(--product-space-8)]">
              <span className="text-[12.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                エリア
              </span>
              <ReviewInput
                value={value.area}
                onChange={(area) => onChange({ ...value, area: cap(area, MAX_AREA_LENGTH) })}
                placeholder="例: 三宮"
              />
            </label>

            <label className="flex flex-col gap-[var(--product-space-8)]">
              <span className="text-[12.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                ジャンル
              </span>
              <ReviewInput
                value={value.genre}
                onChange={(genre) => onChange({ ...value, genre: cap(genre, MAX_GENRE_LENGTH) })}
                placeholder="例: パンケーキ"
              />
            </label>
          </div>

          <div className="mt-[var(--product-space-20)]">
            <ReviewButton variant="primary" type="submit">
              実測でチェックする
            </ReviewButton>
          </div>

          <p
            className="mt-[var(--product-space-12)] text-xs leading-[1.8]"
            style={{ color: "var(--product-color-text-secondary)" }}
          >
            <b className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              β版はClaudeのみ実測
            </b>
            です。ChatGPT / Gemini の同時計測は開発中です。本ツールは掲載を保証するものではなく、
            <b className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              現状を可視化するためのもの
            </b>
            です。
          </p>
        </form>
      </Card>

      {/* ── 3ステップ ────────────────────────────── */}
      <div className="mt-[var(--product-space-8)] grid grid-cols-1 gap-[var(--product-space-8)] pb-[var(--product-space-32)] md:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.no} className="p-[var(--product-space-16)]">
            <span
              className="text-[22px]"
              style={{
                fontFamily: "var(--font-barlow), sans-serif",
                fontWeight: 600,
                color: "var(--product-color-text-secondary)",
              }}
            >
              {step.no}
            </span>
            <p className="mt-[var(--product-space-4)] text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {step.title}
            </p>
            <p className="mt-[var(--product-space-2)] text-[12.5px] leading-[1.65]" style={{ color: "var(--product-color-text-secondary)" }}>
              {step.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
