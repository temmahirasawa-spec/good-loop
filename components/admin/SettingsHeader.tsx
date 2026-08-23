"use client";

import { usePathname } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { SettingsTabBar } from "@/components/admin/SettingsTabBar";
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

const ICONS = {
  brand: BrandIcon,
  store: StoreIcon,
  pop: PopIcon,
  survey: SurveyIcon,
  notification: NotificationIcon,
  billing: BillingIcon,
  account: AccountIcon,
} as const;

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
      {/*
        PCの見出しはページ名（2026-08-23、Figmaコメント 1895938126「各ページここはページ名になる。
        そしてアイコンはここに置く」）。タブを廃止したPCでは、これが現在地の表示を兼ねる。
      */}
      {(() => {
        const item = SETTINGS_NAV.find((n) => pathname.startsWith(n.href));
        const Icon = item ? ICONS[item.icon] : null;
        return (
          <div className="hidden items-center gap-3 md:flex">
            {Icon && <Icon />}
            <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {item ? item.label : "設定"}
            </p>
          </div>
        );
      })()}
      {!isMenu && <SettingsTabBar />}
    </>
  );
}
