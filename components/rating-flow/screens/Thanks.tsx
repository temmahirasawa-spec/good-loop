"use client";

import { CheckCircleOutlineIcon } from "../icons";

/** 06 / サンクス（★1-3）（Figma node 1:415） */
export function Thanks({ googleReviewUrl }: { googleReviewUrl: string | null }) {
  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center gap-[var(--product-space-20)] px-[var(--product-space-24)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <CheckCircleOutlineIcon className="size-16 shrink-0" />
      <p className="text-center text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        ご意見ありがとうございました
      </p>
      <p className="text-center text-sm font-medium leading-[1.8] tracking-[0.14px]" style={{ color: "var(--product-color-text-secondary)" }}>
        いただいた内容は店舗責任者が確認し
        <br />
        改善に活かしてまいります
      </p>
      {googleReviewUrl && (
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-full flex-col items-center gap-[var(--product-space-8)] rounded-[14px] border-solid p-[var(--product-space-16)]"
          style={{ backgroundColor: "var(--product-color-surface-white)", borderWidth: 1, borderColor: "var(--product-color-border-divider)" }}
        >
          <p className="text-sm font-bold tracking-[0.14px]" style={{ color: "var(--product-color-text-secondary)" }}>
            Googleにクチコミを投稿する
          </p>
          <p className="text-center text-[11px] font-medium tracking-[0.22px]" style={{ color: "var(--product-color-text-tertiary)" }}>
            評価にかかわらずご投稿いただけます
          </p>
        </a>
      )}
    </div>
  );
}
