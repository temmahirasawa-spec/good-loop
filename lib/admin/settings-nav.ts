/**
 * 設定の項目一覧。**ここが唯一の正**（2026-08-22）。
 *
 * これまで PCのタブバー・SPのドロワー・設定メニュー画面の3箇所に同じ一覧を書いていたため、
 * 「卓上POPをタブには足したがドロワーには足していない」「設定の下層リンクをSPには入れたが
 * PCサイドバーには入れていない」という取りこぼしが実際に起きた。
 * 項目を足すときはこのファイルだけを直せばよい形にする。
 *
 * `icon` はアイコンの識別子。実体（SVG）は components/admin/SettingsMenuIcons.tsx にあり、
 * 使う側で対応づける（このファイルをサーバー・クライアントの両方から読めるようにするため）。
 */

export type SettingsNavItem = {
  href: string;
  label: string;
  /** 設定メニュー（SP）のタイルに出す補足説明 */
  description: string;
  icon: "brand" | "store" | "pop" | "survey" | "notification" | "billing" | "account";
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  { href: "/admin/settings/brand", label: "ブランドとテーマ", description: "お客様に見える色とロゴ", icon: "brand" },
  { href: "/admin/settings/stores", label: "店舗・二次元コード管理", description: "店舗の追加と二次元コード", icon: "store" },
  { href: "/admin/settings/pop", label: "卓上POPを作る", description: "印刷して席に置く", icon: "pop" },
  { href: "/admin/settings/survey", label: "アンケート項目", description: "お客様に選んでもらう項目", icon: "survey" },
  { href: "/admin/settings/notifications", label: "通知", description: "低評価が来たときのメール", icon: "notification" },
  { href: "/admin/settings/billing", label: "お支払い", description: "プラン・店舗枠・請求", icon: "billing" },
  { href: "/admin/settings/account", label: "アカウント", description: "メールとパスワード", icon: "account" },
];

/** タブバーは幅が限られるので短い名前にする（中身は同じページ） */
export const SETTINGS_TAB_LABELS: Record<string, string> = {
  "/admin/settings/pop": "卓上POP",
  // ナビは正式名称に戻した（2026-08-23、Figmaコメント 1895939283）が、SPタブは幅が無いので短縮のまま
  "/admin/settings/stores": "店舗管理",
};

export function tabLabel(item: SettingsNavItem): string {
  return SETTINGS_TAB_LABELS[item.href] ?? item.label;
}
