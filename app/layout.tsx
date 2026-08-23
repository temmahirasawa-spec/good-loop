import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Barlow } from "next/font/google";
// 業態別テーマの CSS変数。globals.css より先に読む（Tailwind の宣言より前に置くため）
import "./design-tokens.css";
import "./product-tokens.css";
import "./globals.css";

// Figma のテキストスタイルが Noto Sans JP（本文・見出し）と Barlow（Step Number の数字）。
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-noto-sans-jp",
});
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "GOOD REVIEW",
  description: "実店舗向け Googleレビュー獲得 × 顧客満足度アンケート（株式会社UTUTU）",
};

// フォーム入力時にスマホブラウザが自動でズームする挙動を止める（2026-08-06、天真の依頼）。
// maximumScale=1 で「最大でも等倍まで」にすることで、ピンチズームも入力欄フォーカス時の
// 自動ズームも起きなくなる。お客様側（/r/[storeSlug]）・管理画面（/admin）はこのレイアウトを
// 共有しているため、ここ1箇所の変更で両方に効く。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
