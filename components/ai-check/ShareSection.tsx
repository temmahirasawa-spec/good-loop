"use client";

import { useState } from "react";
import { GhostButton } from "./GhostButton";
import { Card, Eyebrow } from "./Card";

/**
 * 診断のあとに、ツールを人に教えるための導線。
 *
 * ⚠⚠ **診断結果を第三者が見られるURLは作らない。** ⚠⚠
 *   スコアや順位は、そのお店の評価が晒される形になる（2026-08-17 天真の指示）。
 *   したがってここで共有するのは **ツールのURL（/ai-check）だけ**。
 *   店名・スコア・順位はクエリ文字列にも共有文にも入れない。
 *   共有された人は、自分の店で最初から診断することになる。
 *
 * 共有の手段:
 *   - スマホなど Web Share API が使える環境 … OSの共有シートを開く
 *   - それ以外                              … リンクをクリップボードにコピー
 *   SNSごとのボタンは置いていない。ブランド色を使うことになり、
 *   デザイントークンの外に出てしまうため（CLAUDE.md 4章）。
 */

const SHARE_TITLE = "AI視認性チェッカー | GOOD REVIEW";
const SHARE_TEXT =
  "AIに「このあたりでおすすめのお店は？」と聞いたとき、自分の店が出てくるかを無料で調べられます。";

export function ShareSection({ onNotify }: { onNotify: (message: string) => void }) {
  const [copied, setCopied] = useState(false);

  /** 共有するのは常にツールのURL。診断結果は含めない */
  function shareUrl(): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      onNotify("リンクをコピーしました");
      setTimeout(() => setCopied(false), 2600);
    } catch {
      onNotify("コピーできませんでした。URLを直接お使いください");
    }
  }

  async function share() {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl() });
    } catch {
      // 利用者が共有シートを閉じただけのこともあるので、何も言わない
    }
  }

  return (
    <Card className="p-[var(--product-space-20)] md:p-[var(--product-space-24)]">
      <Eyebrow>Share</Eyebrow>

      <h3
        className="mt-[var(--product-space-8)] text-[17px] font-bold leading-[1.5]"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        同じ悩みのお店に教える
      </h3>
      <p
        className="mt-[var(--product-space-8)] text-[13px] leading-[1.9]"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
        近隣のお店や、同業の知り合いにも試してもらえます。
        <b className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          共有されるのはツールのリンクだけで、あなたの診断結果（店名・スコア・順位）は
          相手に見えません。
        </b>
      </p>

      <div className="mt-[var(--product-space-16)] flex flex-col gap-[var(--product-space-8)] md:flex-row">
        <div className="md:flex-1">
          <GhostButton onClick={share}>このツールを共有する</GhostButton>
        </div>
        <div className="md:flex-1">
          <GhostButton onClick={copyLink}>
            {copied ? "コピーしました" : "リンクをコピー"}
          </GhostButton>
        </div>
      </div>
    </Card>
  );
}
