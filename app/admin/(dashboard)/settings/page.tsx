import Link from "next/link";
import {
  AccountIcon,
  BillingIcon,
  BrandIcon,
  NotificationIcon,
  PopIcon,
  StoreIcon,
  SurveyIcon,
} from "@/components/admin/SettingsMenuIcons";
import { SETTINGS_NAV } from "@/lib/admin/settings-nav";

/** 一覧は lib/admin/settings-nav.ts が正。ここではアイコンの実体だけ対応づける */
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
 * 設定のメニュー（Figma `設定（メニュー） — SP 390`）。
 *
 * 2026-08-22、天真の決定（docs/ui-review.md Q6 ＋ Figmaコメント）で新設。
 * スマホでは設定タブ6つのうち約45%が画面の外にあり、しかも横スクロールできる印が無かった。
 * iPhoneの設定アプリと同じく**1枚のメニュー**にし、押すと個別ページへ、戻るは左上の矢印。
 * 2列のタイルにアイコンと補足説明を付ける（案C＋コメントの指示）。
 *
 * PCはタブのままなので、サイドバーの「設定」は個別ページ（ブランドとテーマ）へ直接送る。
 * この画面はスマホのドロワーから来たときの入口。
 */


export default function AdminSettingsPage() {
  return (
    <div className="grid w-full grid-cols-2 gap-3 md:max-w-[720px]">
      {SETTINGS_NAV.map(({ href, label, description, icon }) => {
        const Icon = ICONS[icon];
        return (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-start gap-2 rounded-2xl px-3 py-4"
          style={{ backgroundColor: "var(--product-color-surface-white)" }}
        >
          <Icon />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {label}
            </span>
            <span className="text-[11px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {description}
            </span>
          </span>
        </Link>
        );
      })}
    </div>
  );
}
