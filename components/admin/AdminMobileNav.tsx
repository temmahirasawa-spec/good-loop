"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreName } from "./StoreNameContext";
import { SETTINGS_NAV } from "@/lib/admin/settings-nav";

/**
 * SP管理画面のトップバー（Figma node 79:1535 / 54:927）＋ドロワー（node 50:881）。
 * トップレベル画面（トップ・回答一覧・設定）はハンバーガー、
 * 店舗詳細のようなサブページは戻るボタンにする（backHref を渡す）。
 */
const NAV_ITEMS = [
  { href: "/admin", label: "トップ" },
  // 集計（2026-08-22 新設。docs/specs/analytics.md）
  { href: "/admin/analytics", label: "集計" },
  { href: "/admin/responses", label: "回答一覧" },
  // 2026-08-23、SPもタブに戻したのでPCと同じく最初のタブへ直接送る（Figmaコメント 1895812707）
  { href: "/admin/settings/brand", label: "設定" },
];


export function AdminMobileTopBar({
  title,
  backHref,
}: {
  title: string;
  backHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const storeName = useStoreName();

  return (
    <>
      <div className="flex h-12 w-full shrink-0 items-center gap-3 px-1 py-0.5 md:hidden">
        {backHref ? (
          <Link
            href={backHref}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border"
            style={{ borderColor: "var(--product-color-border-divider)", backgroundColor: "var(--product-color-surface-white)" }}
          >
            <span className="text-lg font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              ←
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="メニューを開く"
            className="flex size-11 shrink-0 flex-col items-center justify-center gap-[5px] rounded-xl border"
            style={{ borderColor: "var(--product-color-border-divider)", backgroundColor: "var(--product-color-surface-white)" }}
          >
            <span className="block h-0.5 w-4 rounded-full" style={{ backgroundColor: "var(--product-color-text-primary)" }} />
            <span className="block h-0.5 w-4 rounded-full" style={{ backgroundColor: "var(--product-color-text-primary)" }} />
            <span className="block h-0.5 w-4 rounded-full" style={{ backgroundColor: "var(--product-color-text-primary)" }} />
          </button>
        )}
        <p className="text-lg font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <div
            className="absolute left-0 top-0 flex h-full w-[300px] flex-col items-start gap-1 overflow-y-auto px-4 py-8"
            style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "6px 0px 24px 0px rgba(0,0,0,0.18)" }}
          >
            <p className="whitespace-nowrap text-base font-bold tracking-[0.64px]" style={{ color: "var(--product-color-text-primary)" }}>
              GOOD LOOP
            </p>
            <p className="whitespace-nowrap text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {storeName}
            </p>
            <div className="h-5 w-full shrink-0" />
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-full shrink-0 items-center rounded-[10px] px-3.5 py-2.5"
                  style={{ backgroundColor: active ? "var(--product-color-text-primary)" : "transparent" }}
                >
                  <span
                    className="flex-1 text-sm"
                    style={{
                      fontWeight: active ? 700 : 500,
                      color: active ? "var(--product-color-text-inverse)" : "var(--product-color-text-primary)",
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* 設定の下層ページ。設定そのものを開かなくても直接飛べる */}
            <div className="mt-1 flex w-full flex-col items-start gap-0.5 border-l pl-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
              {SETTINGS_NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 w-full shrink-0 items-center rounded-[10px] px-3 py-2"
                  >
                    <span
                      className="flex-1 text-[13px]"
                      style={{
                        fontWeight: active ? 700 : 400,
                        color: active ? "var(--loop-accent-primary)" : "var(--product-color-text-secondary)",
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
                </div>
        </div>
      )}
    </>
  );
}
