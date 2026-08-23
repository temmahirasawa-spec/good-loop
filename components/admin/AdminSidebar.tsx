"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV } from "@/lib/admin/settings-nav";
import {
  AccountIcon,
  BillingIcon,
  BrandIcon,
  NotificationIcon,
  PopIcon,
  StoreIcon,
  SurveyIcon,
} from "@/components/admin/SettingsMenuIcons";

/*
 * 下層リンクの左に置く小アイコン（2026-08-23、Figmaコメント 1895963412）。
 * このサイズだと1.8pxの線は潰れるため、Figmaの Size=sm（16px・1px線）に合わせて small で描く。
 */
const SETTINGS_ICONS = {
  brand: BrandIcon,
  store: StoreIcon,
  pop: PopIcon,
  survey: SurveyIcon,
  notification: NotificationIcon,
  billing: BillingIcon,
  account: AccountIcon,
} as const;

/** Loop / Admin Sidebar（Figma node 48:851）— LOOP管理画面のサイドナビ */
const NAV_ITEMS = [
  { href: "/admin", label: "トップ", match: "/admin" },
  // 集計（2026-08-22 新設。docs/specs/analytics.md）。トップと回答一覧の間に置く
  { href: "/admin/analytics", label: "集計", match: "/admin/analytics" },
  { href: "/admin/responses", label: "回答一覧", match: "/admin/responses" },
  // PCはタブで切り替えるので、メニュー画面を経由せず最初のタブへ直接送る（UI検証Q6）
  { href: "/admin/settings/brand", label: "設定", match: "/admin/settings" },
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
        const active = item.match === "/admin" ? pathname === "/admin" : pathname.startsWith(item.match);
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

      {/*
        設定の下層ページ。SPのドロワーだけに入れていて、PCのサイドバーに入れ忘れていた
        （2026-08-22 天真の指摘）。一覧の実体は lib/admin/settings-nav.ts に一本化した。
      */}
      <div className="mt-1 flex w-full flex-col items-start gap-0.5 border-l pl-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
        {SETTINGS_NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = SETTINGS_ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-9 w-full shrink-0 items-center gap-2 rounded-[10px] px-3 py-1.5"
            >
              <Icon small />
              <span
                className="flex-1 text-[12.5px]"
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
  );
}
