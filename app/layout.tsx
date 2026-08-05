import type { Metadata } from "next";
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
  title: "GOOD LOOP",
  description: "実店舗向け Googleレビュー獲得 × 顧客満足度アンケート（株式会社UTUTU）",
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
