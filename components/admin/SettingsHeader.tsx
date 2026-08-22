"use client";

import { usePathname } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { SettingsTabBar } from "@/components/admin/SettingsTabBar";

/**
 * 設定画面の共通ヘッダー（Figma node 69:1278 系 / SP 75:1613 系）。
 *
 * 2026-08-22、天真の決定（docs/ui-review.md Q6）でPCとSPの構造を分けた。
 *
 *   PC … これまでどおりタブバー
 *   SP … `/admin/settings` のメニューから入り、個別ページでは左上の戻る矢印でメニューへ戻る
 *
 * メニュー画面自身（`/admin/settings`）ではタブも戻る矢印も出さない。
 * どのページにいるかで出し分けるため、レイアウト（サーバー側）ではなくここで判定する。
 */
export function SettingsHeader() {
  const pathname = usePathname();
  const isMenu = pathname === "/admin/settings";

  return (
    <>
      <AdminMobileTopBar title="設定" backHref={isMenu ? undefined : "/admin/settings"} />
      <p className="hidden text-xl font-bold md:block" style={{ color: "var(--product-color-text-primary)" }}>
        設定
      </p>
      {!isMenu && <SettingsTabBar />}
    </>
  );
}
