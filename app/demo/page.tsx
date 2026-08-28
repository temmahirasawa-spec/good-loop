import type { Metadata } from "next";
import { DemoSurvey } from "@/components/demo/DemoSurvey";

/**
 * アンケート v2 のプロトタイプ（docs/specs/survey-v2.md 段1）。
 *
 * **検証専用。DBに書き込まず、AIも呼ばない。** 実機でタップのテンポを確かめるために置いている。
 * 本番のお客様導線（/r/[storeSlug]）とは無関係で、こちらに影響しない。
 */
export const metadata: Metadata = {
  title: "アンケート検証用デモ | GOOD REVIEW",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoSurvey />;
}
