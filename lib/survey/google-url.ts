/**
 * 来店客を Google マップのクチコミ投稿へ連れていく URL（docs/specs/rating-flow.md の Google 直リンク）。
 *
 * 旧い画面（components/rating-flow/RatingFlow.tsx）と同じ優先順位：
 *   1. place_id があれば、投稿画面を直接開く
 *   2. 無ければ、店舗に登録した Google マップの URL
 *   3. どちらも無ければ、店名で Google マップを検索する（行き止まりにしないため）
 */
export function googleReviewUrl(store: {
  name: string;
  googlePlaceId: string | null;
  googleMapsFallbackUrl: string | null;
}): string {
  if (store.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(store.googlePlaceId)}`;
  }
  if (store.googleMapsFallbackUrl) return store.googleMapsFallbackUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name)}`;
}
