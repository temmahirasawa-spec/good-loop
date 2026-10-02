import type { Metadata } from "next";
import { V5Survey } from "@/components/survey/V5Survey";
import { V5_TOPICS } from "@/lib/survey/v5-topics";
import "@/components/survey/v5.css";

/**
 * アンケート v5 の検証用デモ（docs/specs/survey-v5.md）。
 *
 * **検証専用。DBには書き込まない**（`demo` を渡している）。本番の `/r/[storeSlug]` も同じ部品を使う。
 * 店は架空の「グッドカフェ」（2026-10-01、実在の店の名前とロゴを外した）。話題は飲食のセット。
 */
export const metadata: Metadata = {
  title: "アンケートv5 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

/** LINE Seed JP（Figma とWebサイトの書体）。next/font/google の一覧に無いので Google Fonts の CSS を直接読む */
const LINE_SEED_JP = "https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&display=swap";

const DEMO_STORE = { id: null, name: "グッドカフェ", logoUrl: null, googleReviewUrl: null };

export default function DemoV5Page() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- next/font/google の一覧に無い書体。next/font/local（サブセット化）に移すまではこの読み方 */}
      <link rel="stylesheet" href={LINE_SEED_JP} precedence="default" />
      <V5Survey store={DEMO_STORE} topics={V5_TOPICS} demo />
    </>
  );
}
