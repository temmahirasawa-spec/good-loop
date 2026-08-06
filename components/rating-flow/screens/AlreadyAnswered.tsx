"use client";

import { CheckCircleOutlineIcon } from "../icons";

/**
 * E-5（重複回答対策）。localStorageの回答済みフラグを検知したときに、01画面の代わりに表示する。
 * Figmaに対応ノードが無いため、06サンクス画面と同じ構成（アイコン＋見出し＋説明文）を流用した。
 * 文言は天真確認済み（2026-08-06、案2）。
 */
export function AlreadyAnswered({ storeName }: { storeName: string }) {
  return (
    <div
      className="flex w-full flex-1 flex-col items-center justify-center gap-[var(--product-space-20)] px-[var(--product-space-24)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <CheckCircleOutlineIcon className="size-16 shrink-0" />
      <p className="text-center text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        すでにご回答いただいています
      </p>
      <p className="text-center text-sm font-medium leading-[1.8] tracking-[0.14px]" style={{ color: "var(--product-color-text-secondary)" }}>
        {storeName}への
        <br />
        ご協力ありがとうございました
      </p>
    </div>
  );
}
