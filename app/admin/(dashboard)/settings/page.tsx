import Link from "next/link";
import {
  AccountIcon,
  BillingIcon,
  BrandIcon,
  NotificationIcon,
  StoreIcon,
  SurveyIcon,
} from "@/components/admin/SettingsMenuIcons";

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

const MENU = [
  { href: "/admin/settings/brand", label: "ブランドとテーマ", description: "お客様に見える色とロゴ", Icon: BrandIcon },
  { href: "/admin/settings/stores", label: "店舗・二次元コード管理", description: "店舗の追加と二次元コード", Icon: StoreIcon },
  { href: "/admin/settings/survey", label: "アンケート項目", description: "お客様に選んでもらう項目", Icon: SurveyIcon },
  { href: "/admin/settings/notifications", label: "通知", description: "低評価が来たときのメール", Icon: NotificationIcon },
  { href: "/admin/settings/billing", label: "お支払い", description: "プラン・店舗枠・請求", Icon: BillingIcon },
  { href: "/admin/settings/account", label: "アカウント", description: "メールとパスワード", Icon: AccountIcon },
  // 卓上POPは店舗・二次元コード管理と対になる作業なので、メニューにも直接の導線を置く
  // （2026-08-22 天真のFigmaコメント「卓上POPを作るへの導線を」）
  { href: "/admin/settings/pop", label: "卓上POPを作る", description: "印刷して席に置く", Icon: StoreIcon },
];

export default function AdminSettingsPage() {
  return (
    <div className="grid w-full grid-cols-2 gap-3 md:max-w-[720px]">
      {MENU.map(({ href, label, description, Icon }) => (
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
      ))}
    </div>
  );
}
