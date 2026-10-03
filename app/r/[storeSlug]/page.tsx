import { notFound } from "next/navigation";
import { V5Survey } from "@/components/survey/V5Survey";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSurveyStopped } from "@/lib/billing/survey-gate";
import { V5PausedNotice } from "@/components/survey/V5PausedNotice";
import { googleReviewUrl } from "@/lib/survey/google-url";
import { v5TopicsFor } from "@/lib/survey/v5-topics";
import "@/components/survey/v5.css";

// 動的なSupabaseデータを毎リクエスト取得する（静的プリレンダー・fetchキャッシュで
// 固定化されるのを防ぐ。2026-08-06、本番で新規タグが反映されない不具合の原因だった）
export const dynamic = "force-dynamic";

/** LINE Seed JP（Figma とWebサイトの書体）。next/font/google の一覧に無いので Google Fonts の CSS を直接読む */
const LINE_SEED_JP = "https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&display=swap";

/**
 * 来店客の入口URL（docs/specs/rating-flow.md A-5）。`https://app.good-review.jp/r/[storeSlug]`。
 *
 * 2026-10-01、画面を v5 にした（docs/specs/survey-v5.md）。**★で行き先を分けない。**
 * 旧い画面（components/rating-flow/RatingFlow.tsx・★4以上だけ Google へ案内し、AIが全文を書く）は使わない。
 *
 * 来店客はログインしない前提（rating-flow.md）なので、RLSではなく admin client
 * （service_role・RLSを迂回）で読む。stores の SELECT には anon ロールへの GRANT を
 * 与えていない（supabase/0003_grants.sql）ため、ここは意図的に admin client を使う。
 */
export default async function SurveyPage({ params }: { params: { storeSlug: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id, tenant_id, name, slug, logo_url, loop_theme, business_category, google_place_id, google_maps_fallback_url")
    .eq("slug", params.storeSlug)
    .maybeSingle();

  if (!store) notFound();

  // カードを登録する前（申し込みから来た契約先）と、お休みのあいだは止める（docs/specs/billing.md §3-2・§3-8）。
  // 読み取りの記録（page_views）も数えない。回答の API も同じ判定で断っている
  if (await isSurveyStopped(supabase, store.tenant_id)) return <V5PausedNotice />;

  // QR読み取り数の元データ（launch-plan.md C節）。失敗しても来店客の画面は止めない
  await supabase
    .from("page_views")
    .insert({ tenant_id: store.tenant_id, store_id: store.id })
    .then(() => {}, () => {});

  return (
    // data-review-theme は店舗が選んだ色テーマをそのまま渡す（緑の部分＝--review-accent-* が業態の色になる）
    <div data-review-theme={store.loop_theme}>
      {/* eslint-disable-next-line @next/next/no-css-tags -- next/font/google の一覧に無い書体。next/font/local（サブセット化）に移すまではこの読み方 */}
      <link rel="stylesheet" href={LINE_SEED_JP} precedence="default" />
      <V5Survey
        store={{
          id: store.id,
          name: store.name,
          logoUrl: store.logo_url,
          googleReviewUrl: googleReviewUrl({
            name: store.name,
            googlePlaceId: store.google_place_id,
            googleMapsFallbackUrl: store.google_maps_fallback_url,
          }),
        }}
        topics={v5TopicsFor(store.business_category)}
      />
    </div>
  );
}
