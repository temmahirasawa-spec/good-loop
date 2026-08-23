import { getSettingsStores, selectStore } from "@/lib/admin/current-store";
import { StoreSwitchTabs } from "@/components/admin/StoreSwitchTabs";
import { PopEditor } from "@/components/admin/PopEditor";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 設定（卓上POP） Figma `Modal / 卓上POPを作る — PC` / `卓上POPを作る — SP 390`。
 *
 * 2026-08-22、天真のFigmaコメントで新設。3つのデザインから選び、
 * 見出し・本文・QRの大きさを店舗ごとに保存できる（supabase/0012）。
 */
type PopRow = { id: string; slug: string; pop_preset: string; pop_heading: string | null; pop_note: string | null; pop_qr_size: string };

export default async function SettingsPopPage({ searchParams }: { searchParams: { store?: string } }) {
  const stores = await getSettingsStores();
  const store = selectStore(stores, searchParams.store);
  if (!store) return null;

  const supabase = await createSupabaseServerClient();
  // QRのURLは店舗一覧のslugから作れるので、行の取得と並列に生成する（遷移の高速化）
  const [{ data }, qrSvg] = await Promise.all([
    supabase
      .from("stores")
      .select("id, slug, pop_preset, pop_heading, pop_note, pop_qr_size")
      .eq("id", store.id)
      .maybeSingle<PopRow>(),
    generateQrSvg(`${PUBLIC_APP_URL}/r/${store.slug}`),
  ]);
  if (!data) return null;

  return (
    <>
      <StoreSwitchTabs stores={stores} selectedId={store.id} />
      <PopEditor
        key={store.id}
        storeId={store.id}
        storeName={store.name}
        qrSvg={qrSvg}
        initial={{
          preset: data.pop_preset,
          heading: data.pop_heading ?? "",
          note: data.pop_note ?? "",
          qrSize: data.pop_qr_size,
        }}
      />
    </>
  );
}
