import { RatingFlow } from "@/components/rating-flow/RatingFlow";

/**
 * 来店客の入口URL（docs/specs/rating-flow.md A-5）。
 * `https://app.goodloop.jp/r/[storeSlug]` を想定。
 *
 * ⚠ Supabaseプロジェクトがまだ無い（docs/handoff.md参照）ため、storeSlugから実店舗を
 * 引く処理はまだ書けない。プロジェクトができたら、ここで supabase/0001_rating_flow_schema.sql の
 * `stores` テーブルを slug で引き、name / loop_theme / google_place_id 等を渡すこと。
 * それまでは画面の動作確認ができるよう、仮の店舗データを使っている。
 */
export default function RatingFlowPage({ params }: { params: { storeSlug: string } }) {
  const store = {
    name: params.storeSlug,
    slug: params.storeSlug,
    googlePlaceId: null,
    googleMapsFallbackUrl: null,
  };

  return (
    // data-loop-theme は実店舗の loop_theme が決まってから渡す。無指定時は Clinic（既定）
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      <RatingFlow store={store} />
    </div>
  );
}
