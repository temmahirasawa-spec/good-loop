import type { Metadata } from "next";
import { V5PausedNotice } from "@/components/survey/V5PausedNotice";
import "@/components/survey/v5.css";

/**
 * 停止中のお知らせ（v5・案B）の確認用ページ。**検証専用・noindex。**
 * 本番の `/r/[storeSlug]` にはまだ繋いでいない（components/survey/V5PausedNotice.tsx の注意書きを参照）。
 */
export const metadata: Metadata = {
  title: "停止中のお知らせ（v5）検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

/** LINE Seed JP（Figma とWebサイトの書体）。/demo/v5 と同じ読み方 */
const LINE_SEED_JP = "https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&display=swap";

export default function DemoV5PausedPage() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- 試作の書体だけ。本番化するときは next/font/local（サブセット化）に移す */}
      <link rel="stylesheet" href={LINE_SEED_JP} precedence="default" />
      <V5PausedNotice />
    </>
  );
}
