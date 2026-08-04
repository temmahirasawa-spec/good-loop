import type { Metadata } from "next";
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
