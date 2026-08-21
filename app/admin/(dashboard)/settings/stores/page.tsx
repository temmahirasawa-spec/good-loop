import { SettingsStoresView } from "@/components/admin/SettingsStoresView";
import { getStoreSummaries } from "@/lib/admin/queries";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";

// 動的な集計データを毎リクエスト取得する（静的プリレンダーで数値が固定化されるのを防ぐ）
export const dynamic = "force-dynamic";

const LOW_READS_THRESHOLD = 20;

/**
 * 設定（店舗・二次元コード管理） Figma node 73:1364 PC / 75:1803 SP。
 *
 * 2026-08-06、天真の依頼で旧 /admin/qr（二次元コード発行）をここに統合した。
 * 店舗の追加・編集と二次元コードの発行は同じ単位（店舗）に対する操作のため、
 * 別画面に分けず1画面にまとめている。
 *
 * 2026-08-21、店舗枠（supabase/0009）を導入。空きが無いと追加できない。
 */
export default async function SettingsStoresPage() {
  const [stores, quota] = await Promise.all([getStoreSummaries(), getStoreQuotaState()]);
  const storesWithQr = await Promise.all(
    stores.map(async (s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      businessCategory: s.businessCategory,
      googlePlaceLinked: s.googlePlaceLinked,
      qrSvg: await generateQrSvg(`${PUBLIC_APP_URL}/r/${s.slug}`),
      qrReads: s.qrReads,
      qrReadsLow: s.qrReads < LOW_READS_THRESHOLD,
    }))
  );
  return (
    <SettingsStoresView
      stores={storesWithQr}
      quota={{ quota: quota.quota, used: quota.used, canAddStore: quota.canAddStore }}
    />
  );
}
