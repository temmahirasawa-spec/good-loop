import type { Metadata } from "next";
import { V5Survey } from "@/components/survey/V5Survey";

/**
 * アンケート v5 のプロトタイプ（docs/specs/survey-v5.md）。
 *
 * **検証専用。DBには書き込まない。** v4（/demo/v4）はそのまま残してあるので、並べて比べられる。
 * 本番のお客様導線（/r/[storeSlug]）とは無関係で、こちらに影響しない。
 */
export const metadata: Metadata = {
  title: "アンケートv5 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

export default function DemoV5Page() {
  return <V5Survey />;
}
