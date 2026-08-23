"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV, tabLabel } from "@/lib/admin/settings-nav";

/**
 * Loop / Settings Tab Bar（Figma node 79:1541 等）— 設定画面のタブ切り替え。URLで状態を持つ。
 *
 * 2026-08-22にPC専用にした（docs/ui-review.md Q6。スマホでは6タブの約45%が画面の外にあり、
 * 横スクロールできる印が無かったため）。**2026-08-23、天真の指示でSPでもタブに戻した**
 * （Figmaコメント 1895812707「上部に各設定画面へのタブを付けてください」。一度動かして判断したい、とのこと）。
 * SPでは横スクロールになるので、端が切れて見えることで「まだ先がある」と分かるよう、
 * 右端に余白を残している。メニュー画面（`/admin/settings`）は残してあるので、戻すのは1行。
 *
 * **PCでは出さない**（2026-08-23、Figmaコメント 1895836247「PC版はここのタブいらない
 * （サイドバー常時表示なので」）。PCの現在地はサイドバーの設定下層リンクが示す。
 *
 * 同日、**アクティブの示し方をベタ塗りのピルから下線に変えた**（天真のFigmaコメント）。
 * ピルのままだとボタンと見分けがつかないため。ピル型は `Loop / Segment Chip`
 * （期間・分岐などの絞り込み）に残す。Figmaは `Loop / Tab Item`。
 */

export function SettingsTabBar() {
  const pathname = usePathname();

  return (
    <div className="flex w-full shrink-0 items-start gap-2 overflow-x-auto pr-6 md:hidden">
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
