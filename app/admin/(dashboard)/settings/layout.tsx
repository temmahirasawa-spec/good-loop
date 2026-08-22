import { SettingsHeader } from "@/components/admin/SettingsHeader";

/**
 * 設定のタブ切り替え共通レイアウト（Figma node 69:1278 系 / SP 75:1613 系）。
 * 見出しとタブ／戻る矢印の出し分けは SettingsHeader（クライアント側）が行う。
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsHeader />
      {children}
    </>
  );
}
