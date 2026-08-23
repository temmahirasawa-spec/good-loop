"use client";

import type { ReactNode } from "react";
import { LockIcon } from "./icons";

/**
 * 続きをメールアドレスの登録で開放する区画（2026-08-17 天真の指示）。
 *
 * 中身の頭だけを見せ、下に向かってグラデーションで消していく。
 *
 * ⚠ **視覚的に隠しているだけで、HTMLのソースには続きが入っている。**
 *   ここで扱うのは機密ではなく、あくまで「続きを見たくなる」ための導線なので、
 *   読み上げソフトの利用者だけ体験が変わることのないよう、あえてDOMから消していない。
 *   本当に秘匿が必要な内容を将来ここに入れるなら、サーバー側で出し分けること。
 */
export function LockedContent({
  children,
  /** 見せる高さ（px）。中身の分量に合わせて調整する */
  visibleHeight,
  onUnlock,
}: {
  children: ReactNode;
  visibleHeight: number;
  onUnlock: () => void;
}) {
  return (
    <div>
      <div className="relative overflow-hidden" style={{ maxHeight: `${visibleHeight}px` }}>
        {children}

        {/* 下端に向かってカードの地色へ溶かす。装飾なので支援技術からは隠す */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[88px]"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--product-color-surface-white))",
          }}
        />
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="mt-[var(--product-space-12)] flex w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-md)] border border-solid px-[var(--product-space-16)] py-[var(--product-space-12)]"
        style={{
          backgroundColor: "var(--review-accent-wash)",
          borderColor: "var(--review-accent-light)",
          color: "var(--review-accent-primary)",
        }}
      >
        <LockIcon className="size-[15px] shrink-0" />
        <span className="text-[13px] font-bold">続きを読む（無料・メール登録）</span>
      </button>
    </div>
  );
}
