import type { Metadata } from "next";
import { V5Survey } from "@/components/survey/V5Survey";
import "./v5.css";

/**
 * アンケート v5 のプロトタイプ（docs/specs/survey-v5.md）。
 *
 * **検証専用。DBには書き込まない。** v4（/demo/v4）はそのまま残してあるので、並べて比べられる。
 * 本番のお客様導線（/r/[storeSlug]）とは無関係で、こちらに影響しない。
 * 見た目と動きは ./v5.css（/demo/v5 の中だけに効く）。
 */
export const metadata: Metadata = {
  title: "アンケートv5 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

/** LINE Seed JP（Figma とWebサイトの書体）。next/font/google の一覧に無いので Google Fonts の CSS を直接読む */
const LINE_SEED_JP = "https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&display=swap";

export default function DemoV5Page() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags -- 試作の書体だけ。本番化するときは next/font/local（サブセット化）に移す */}
      <link rel="stylesheet" href={LINE_SEED_JP} precedence="default" />
      <V5Survey />
    </>
  );
}
