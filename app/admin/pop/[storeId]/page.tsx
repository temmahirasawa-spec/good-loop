import { notFound, redirect } from "next/navigation";
import { getBillingState } from "@/lib/billing/state";
import { PopPrintSheet } from "@/components/admin/pop/PopPrintSheet";
import { POP_COLUMNS, popSettingsFromRow, type PopRow } from "@/lib/admin/pop";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintTrigger } from "@/components/admin/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * 卓上POPの印刷ページ（2026-09-29、名刺サイズに作り直した）。
 *
 * 別ライブラリでPDFを作らず、**ブラウザの印刷で A4 の PDF にする**（「PDFとして保存」はどのブラウザにもある）。
 * A4 の名刺用紙（10面・91×55mm）に同じ名刺を10枚並べる。`@page { size: A4; margin: 0 }` なので、
 * 印刷の画面で倍率を「100%」にすれば市販の名刺用紙の切れ目にそろう。
 *
 * `(dashboard)` の外に置いてあるのは、サイドバーやタブを紙に載せないため。
 * middleware.ts が `/admin` 配下を守るので、未ログインでは開けない。
 */
type Row = PopRow & { name: string; slug: string; loop_theme: string; logo_url: string | null };

export default async function PopPrintPage({ params }: { params: { storeId: string } }) {
  // 卓上POPの発行はカードを登録してから（docs/specs/billing.md §3-2）。URL を直接開かれても印刷させない
  const billing = await getBillingState();
  if (!billing.access.canUseStoreFeatures) redirect("/admin/settings/pop");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("stores")
    .select(`name, slug, loop_theme, logo_url, ${POP_COLUMNS}`)
    .eq("id", params.storeId)
    .maybeSingle<Row>();
  if (!data) notFound();

  const qrSvg = await generateQrSvg(`${PUBLIC_APP_URL}/r/${data.slug}`);
  const content = { ...popSettingsFromRow(data, data.loop_theme), storeName: data.name, logoUrl: data.logo_url, qrSvg };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-[color:var(--product-color-bg-secondary)] p-6 print:block print:bg-transparent print:p-0">
      <style>{"@page { size: A4; margin: 0; }"}</style>
      <PrintTrigger />
      <div className="shadow-md print:shadow-none">
        <PopPrintSheet content={content} unit="0.25mm" />
      </div>
    </main>
  );
}
