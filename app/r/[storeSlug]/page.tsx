import { notFound } from "next/navigation";
import { RatingFlow } from "@/components/rating-flow/RatingFlow";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 来店客の入口URL（docs/specs/rating-flow.md A-5）。
 * `https://app.goodloop.jp/r/[storeSlug]` を想定。
 *
 * 来店客はログインしない前提（rating-flow.md）なので、RLSではなく admin client
 * （service_role・RLSを迂回）で読む。stores の SELECT には anon ロールへの GRANT を
 * 与えていない（supabase/0003_grants.sql）ため、ここは意図的に admin client を使う。
 */
export default async function RatingFlowPage({ params }: { params: { storeSlug: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id, tenant_id, name, slug, loop_theme, google_place_id, google_maps_fallback_url")
    .eq("slug", params.storeSlug)
    .maybeSingle();

  if (!store) notFound();

  // QR読み取り数の元データ（launch-plan.md C節）。失敗しても来店客の画面は止めない
  await supabase
    .from("page_views")
    .insert({ tenant_id: store.tenant_id, store_id: store.id })
    .then(() => {}, () => {});

  return (
    // Figmaのフレームは390px固定（02基本形）。data-loop-theme は店舗の業態をそのまま渡す
    <div className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col" data-loop-theme={store.loop_theme}>
      <RatingFlow
        store={{
          id: store.id,
          name: store.name,
          slug: store.slug,
          googlePlaceId: store.google_place_id,
          googleMapsFallbackUrl: store.google_maps_fallback_url,
        }}
      />
    </div>
  );
}
