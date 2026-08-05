"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Loop / Admin Sidebar（Figma node 48:851）— LOOP管理画面のサイドナビ */
const NAV_ITEMS = [
  { href: "/admin", label: "トップ" },
  { href: "/admin/responses", label: "回答一覧" },
  { href: "/admin/qr", label: "二次元コード発行" },
  { href: "/admin/settings", label: "設定" },
];

export function AdminSidebar({ storeName }: { storeName: string }) {
  const pathname = usePathname();

  return (
    <div
      className="hidden h-full w-[228px] shrink-0 flex-col items-start gap-1 px-4 pb-6 pt-7 md:flex"
      style={{ backgroundColor: "var(--product-color-surface-white)", borderRight: `1px solid var(--product-color-border-divider)` }}
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
      <div className="min-h-px w-full flex-1" />
      <p className="whitespace-nowrap text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        ログアウト
      </p>
    </div>
  );
}
