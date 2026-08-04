import type { Metadata } from "next";
// 業態別テーマの CSS変数。globals.css より先に読む（Tailwind の宣言より前に置くため）
import "./design-tokens.css";
import "./globals.css";

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
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
