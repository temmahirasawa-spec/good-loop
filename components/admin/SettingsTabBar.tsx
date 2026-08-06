"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Loop / Settings Tab Bar（Figma node 79:1541 等）— 設定画面のタブ切り替え。URLで状態を持つ */
const TABS = [
  { href: "/admin/settings/brand", label: "ブランドとテーマ" },
  { href: "/admin/settings/stores", label: "店舗・二次元コード管理" },
  { href: "/admin/settings/survey", label: "アンケート項目" },
  { href: "/admin/settings/notifications", label: "通知" },
  { href: "/admin/settings/billing", label: "お支払い" },
  { href: "/admin/settings/account", label: "アカウント" },
];

export function SettingsTabBar() {
  const pathname = usePathname();

  return (
    <div className="flex w-full shrink-0 items-start gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex shrink-0 items-center rounded-full px-5 py-[13px]"
            style={{ backgroundColor: active ? "var(--loop-accent-primary)" : "transparent" }}
          >
            <span className="whitespace-nowrap text-xs font-medium" style={{ color: active ? "var(--loop-accent-on-primary)" : "var(--product-color-text-secondary)" }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
