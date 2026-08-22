"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV, tabLabel } from "@/lib/admin/settings-nav";

/**
 * Loop / Settings Tab Bar（Figma node 79:1541 等）— 設定画面のタブ切り替え。URLで状態を持つ。
 *
 * 2026-08-22から**PC専用**（docs/ui-review.md Q6）。スマホでは6タブの約45%が画面の外に
 * あり、しかも横スクロールできる印が無かったため、`/admin/settings` のメニュー画面に置き換えた。
 *
 * 同日、**アクティブの示し方をベタ塗りのピルから下線に変えた**（天真のFigmaコメント）。
 * ピルのままだとボタンと見分けがつかないため。ピル型は `Loop / Segment Chip`
 * （期間・分岐などの絞り込み）に残す。Figmaは `Loop / Tab Item`。
 */

export function SettingsTabBar() {
  const pathname = usePathname();

  return (
    <div className="hidden w-full shrink-0 items-start gap-2 overflow-x-auto md:flex">
      {SETTINGS_NAV.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex min-h-[44px] shrink-0 items-center px-4"
            style={{
              borderBottom: active ? "2px solid var(--loop-accent-action)" : "2px solid transparent",
            }}
          >
            <span
              className="whitespace-nowrap text-xs"
              style={{
                color: active ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)",
                fontWeight: active ? 700 : 400,
              }}
            >
              {tabLabel(tab)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
