import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { StoreSwitchTabs } from "@/components/admin/StoreSwitchTabs";
import { PopStepEditor } from "@/components/admin/pop/PopStepEditor";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBillingState } from "@/lib/billing/state";
import { POP_COLUMNS, popSettingsFromRow, type PopRow } from "@/lib/admin/pop";

export const dynamic = "force-dynamic";

/**
 * 設定（卓上POPを作る）。Figma App Design Master「13 卓上POP / 名刺サイズ（案3 ステップ）」。
 *
 * 2026-09-29、A6 の3デザインから名刺サイズ（91×55mm・縦横・デザイン6種・9色・ロゴ2つのオン/オフ）に
 * 作り直した（supabase/0018）。天真が3案から「案3（ステップで進める）」を選んだ。
 */
export default async function SettingsPopPage({ searchParams }: { searchParams: { store?: string } }) {
  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);
  if (!store) return null;

  const supabase = await createSupabaseServerClient();
  // カードを登録する前・お休みのあいだは二次元コードを作らない（見本は鍵の絵。印刷はカードの関門。docs/specs/billing.md §3-2）
  const billing = await getBillingState();
  // QRのURLは店舗一覧のslugから作れるので、行の取得と並列に生成する（遷移の高速化）
  const [{ data }, qrSvg] = await Promise.all([
    supabase.from("stores").select(POP_COLUMNS).eq("id", store.id).maybeSingle<PopRow>(),
    billing.access.canUseStoreFeatures ? generateQrSvg(`${PUBLIC_APP_URL}/r/${store.slug}`) : Promise.resolve(null),
  ]);
  if (!data) return null;

  return (
    <>
      <StoreSwitchTabs stores={stores} selectedId={store.id} />
      <PopStepEditor
        key={store.id}
        storeId={store.id}
        storeName={store.name}
        logoUrl={store.logo_url}
        qrSvg={qrSvg}
        initial={popSettingsFromRow(data, store.loop_theme)}
        paused={billing.access.paused}
      />
    </>
  );
}
