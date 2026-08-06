import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { SettingsTabBar } from "@/components/admin/SettingsTabBar";

/**
 * 設定のタブ切り替え共通レイアウト（Figma node 69:1278 系 / SP 75:1613 系）。
 * PC・SPとも「設定」の見出し＋タブバーは全タブで共通なのでここに置く。
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminMobileTopBar title="設定" />
      <p className="hidden text-xl font-bold md:block" style={{ color: "var(--product-color-text-primary)" }}>
        設定
      </p>
      <SettingsTabBar />
      {children}
    </>
  );
}
