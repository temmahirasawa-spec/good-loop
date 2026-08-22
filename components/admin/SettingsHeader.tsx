"use client";

import { usePathname } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { SettingsTabBar } from "@/components/admin/SettingsTabBar";

/**
 * 設定画面の共通ヘッダー（Figma node 69:1278 系 / SP 75:1613 系）。
 *
 * 2026-08-22にPCとSPの構造を分けた（docs/ui-review.md Q6）が、
 * **2026-08-23、天真の指示でSPもタブに戻した**（Figmaコメント 1895812707）。
 * PC・SPとも上部にタブバーを出し、SPでは横スクロールする。
 *
 * メニュー画面（`/admin/settings`）は残してある。SPのメニューからは今も開けるが、
 * 個別ページからはタブで移動するので戻る矢印は出さない。
 * メニュー画面自身ではタブを出さない（そこは入口なので）。
 */
export function SettingsHeader() {
  const pathname = usePathname();
  const isMenu = pathname === "/admin/settings";

  return (
    <>
      <AdminMobileTopBar title="設定" />
      <p className="hidden text-xl font-bold md:block" style={{ color: "var(--product-color-text-primary)" }}>
        設定
      </p>
      {!isMenu && <SettingsTabBar />}
    </>
  );
}
