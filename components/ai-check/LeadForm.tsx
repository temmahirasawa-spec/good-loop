"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";
import { Card, Eyebrow } from "./Card";

/**
 * レポート末尾のCTA（docs/prototypes/ai-visibility-checker.html の .cta）。
 *
 * ⚠ この段階では**保存も送信もしない**（APIを呼ばない）。
 *   保存は POST /api/ai-check/leads で実装する（フェーズ4）。
 *   メール送信は Resend の鍵が未取得のため当面行わない（docs/setup-tasks.md 4）。
 *   そのため文言では送信のタイミングを約束していない。
 */

const STEPS = [
  { no: "01", title: "計測", body: "毎月、AIへの質問を定点観測してスコアの推移を記録します。" },
  { no: "02", title: "改善", body: "口コミ導線・オーナー返信・店舗情報の整備をテンプレートで支援。" },
  { no: "03", title: "報告", body: "何が効いたかを月次レポートでご報告します。" },
];

export function LeadForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");

  return (
    <Card className="p-[var(--product-space-20)] md:p-[var(--product-space-24)]">
      <Eyebrow>Next Step</Eyebrow>

      <h3
        className="mt-[var(--product-space-8)] text-[19px] font-bold leading-[1.5]"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        AIに見えるお店に、変えていく。
      </h3>
      <p
        className="mt-[var(--product-space-8)] text-[13px] leading-[1.9]"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
        GOOD REVIEW は「計測 → 改善 → 再計測」を回し続ける、AI時代の店舗集客サービスです。掲載を約束する魔法ではなく、AIが参照する情報を着実に増やす仕組みを提供します。
      </p>

      <div className="my-[var(--product-space-16)] grid grid-cols-1 gap-[var(--product-space-8)] md:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.no}
            className="rounded-[var(--product-radius-md)] border border-solid p-[var(--product-space-12)]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--loop-accent-light)",
            }}
          >
            <span
              className="text-[15px]"
              style={{
                fontFamily: "var(--font-barlow), sans-serif",
                fontWeight: 600,
                color: "var(--loop-accent-action)",
              }}
            >
              {step.no}
            </span>
            <p className="mt-[var(--product-space-2)] text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {step.title}
            </p>
            <p className="mt-[var(--product-space-2)] text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
              {step.body}
            </p>
          </div>
        ))}
      </div>

      <form
        className="flex flex-col gap-[var(--product-space-8)] md:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(email.trim());
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">メールアドレス</span>
          <LoopInput value={email} onChange={setEmail} placeholder="メールアドレス" type="email" />
        </label>
        <div className="md:w-[240px] md:shrink-0">
          <LoopButton variant="primary" type="submit">
            フルレポートを受け取る（無料）
          </LoopButton>
        </div>
      </form>

      <p className="mt-[var(--product-space-8)] text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
        ご入力いただいた内容は、診断レポートの送付とサービスのご案内にのみ使用します。
      </p>
    </Card>
  );
}
