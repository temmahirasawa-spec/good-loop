"use client";

import { useMounted, usePrefersReducedMotion } from "./hooks";

/**
 * 要因分析（03 · Why）— **社内MTG用のサンプル表示**。
 *
 * ⚠⚠⚠ **ここの点数はすべて架空です。実測していません。** ⚠⚠⚠
 *
 *   口コミ件数・オーナー返信率・情報の鮮度などは、GOOD REVIEW ではまだ測っていない
 *   （オーナー返信率は Google の API では取得できない。
 *    docs/plans/ai-visibility-checker.md 1-3 / 9-1）。
 *
 *   2026-08-17、天真の判断で「本番には出さない社内MTG用のサンプル」として、
 *   docs/prototypes/ai-visibility-checker.html の DEMO.factors の数値をそのまま置いている。
 *   要因分析そのものは別の診断として設計し直す方針。
 *
 *   ⚠ /ai-check は**すでに本番公開されている**。うっかりマージすると架空の点数が
 *     オーナーの目に触れ、自分の店の実測値だと受け取られる。
 *     そのため画面上に「サンプル」の印を出している。**この印を外さないこと。**
 *     実測できるようになったら、このファイルごと差し替える。
 */

const SAMPLE_FACTORS = [
  {
    name: "直近90日の新規口コミ",
    score: 34,
    note: "総数は多い一方、直近の投稿ペースが鈍化。AIは新しい情報を優先します。",
  },
  {
    name: "口コミへのオーナー返信率",
    score: 18,
    note: "返信はAIが拾う信頼シグナル。現状ほぼ未返信です。",
  },
  {
    name: "基本情報の鮮度（営業時間・メニュー）",
    score: 55,
    note: "一部の情報が更新されておらず、AIの回答が古い内容になる恐れがあります。",
  },
  {
    name: "写真の量と質",
    score: 82,
    note: "量・質ともに十分。維持できている強みです。",
  },
  {
    name: "公式サイトの構造化データ",
    score: 40,
    note: "メニュー・営業情報が機械可読になっておらず、AIが参照しにくい状態です。",
  },
  {
    name: "第三者メディア・ブログでの言及",
    score: 61,
    note: "特定の文脈に偏りがあり、周辺キーワードでの言及が空白です。",
  },
];

export function FactorTeaser() {
  const reduced = usePrefersReducedMotion();
  const shown = useMounted(150);

  return (
    <div className="pt-[var(--product-space-4)]">
      {SAMPLE_FACTORS.map((factor, i) => (
        <div
          key={factor.name}
          className="border-b border-solid py-[var(--product-space-12)] last:border-b-0"
          style={{ borderColor: "var(--product-color-border-divider)" }}
        >
          <div className="flex items-baseline justify-between gap-[var(--product-space-8)]">
            <span
              className="text-[13.5px] font-bold"
              style={{ color: "var(--product-color-text-primary)" }}
            >
              {factor.name}
            </span>
            <span
              className="shrink-0 text-[19px]"
              style={{
                fontFamily: "var(--font-barlow), sans-serif",
                fontWeight: 600,
                color: "var(--product-color-text-primary)",
              }}
            >
              {factor.score}
              <span
                className="ml-[var(--product-space-2)] text-[11px] font-medium"
                style={{
                  fontFamily: "var(--font-noto-sans-jp), sans-serif",
                  color: "var(--product-color-text-secondary)",
                }}
              >
                /100
              </span>
            </span>
          </div>

          <div
            className="my-[var(--product-space-8)] h-[7px] overflow-hidden rounded-[var(--product-radius-full)]"
            style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}
          >
            <div
              className="h-full rounded-[var(--product-radius-full)]"
              style={{
                width: shown ? `${factor.score}%` : "0%",
                backgroundColor: "var(--review-accent-primary)",
                transition: reduced ? "none" : `width 0.9s ease ${i * 0.06}s`,
              }}
            />
          </div>

          <p
            className="text-[12.5px] leading-[1.7]"
            style={{ color: "var(--product-color-text-secondary)" }}
          >
            {factor.note}
          </p>
        </div>
      ))}
    </div>
  );
}
