import type { Metadata } from "next";
import { V4Survey } from "@/components/survey/V4Survey";

/**
 * アンケート v4 のプロトタイプ（docs/specs/survey-v4.md）。
 *
 * **検証専用。DBには書き込まない。** v3（/demo）はそのまま残してあるので、並べて比べられる。
 * 本番のお客様導線（/r/[storeSlug]）とは無関係で、こちらに影響しない。
 */
export const metadata: Metadata = {
  title: "アンケートv4 検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

export default function DemoV4Page() {
  return <V4Survey />;
}
