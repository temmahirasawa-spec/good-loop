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
      {/*
        Googleへの導線（2026-08-23、Figmaコメント 1895789775）。
        「小さめに」→「やっぱり小さめだとわざとらしいので、普通サイズで、
        下過ぎるのもわざとらしいので、少し上げる」との指示。
        枠付きのカードをやめて普通サイズの文字リンクにし、本文のすぐ下に置いた。
      */}
      {googleReviewUrl && (
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-[var(--product-space-8)] flex min-h-[var(--product-touch-min)] items-center text-sm font-bold tracking-[0.14px] underline underline-offset-4"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          Googleにクチコミを投稿する
        </a>
      )}
    </div>
  );
}
