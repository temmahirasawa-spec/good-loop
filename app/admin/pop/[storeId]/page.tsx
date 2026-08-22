import { notFound } from "next/navigation";
import { PopSheet } from "@/components/admin/PopSheet";
import { resolvePop } from "@/lib/admin/pop";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintTrigger } from "@/components/admin/PrintTrigger";

export const dynamic = "force-dynamic";

/**
 * 卓上POPの印刷ページ（2026-08-22）。
 *
 * 別ライブラリでPDFを作らず、**ブラウザの印刷でA6のPDFにする**。
 * 「PDFとして保存」はどのブラウザにもあり、印刷までの手数も少ないため。
 * `@page { size: A6 }` を指定してあるので、用紙サイズは自動で選ばれる。
 *
 * `(dashboard)` の外に置いてあるのは、サイドバーやタブを紙に載せないため。
 * middleware.ts が `/admin` 配下を守るので、未ログインでは開けない。
 */
type PopRow = {
  name: string; slug: string;
  pop_preset: string; pop_heading: string | null; pop_note: string | null; pop_qr_size: string;
};

export default async function PopPrintPage({ params }: { params: { storeId: string } }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("stores")
    .select("name, slug, pop_preset, pop_heading, pop_note, pop_qr_size")
    .eq("id", params.storeId)
    .maybeSingle<PopRow>();
  if (!data) notFound();

  const pop = resolvePop(data);
  const qrSvg = await generateQrSvg(`${PUBLIC_APP_URL}/r/${data.slug}`);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[color:var(--product-color-bg-secondary)] p-6 print:block print:bg-white print:p-0">
      <div className="flex flex-col items-center gap-4 print:gap-0">
        <div className="rounded-lg border print:rounded-none print:border-0" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <PopSheet
            content={{
              storeName: data.name,
              preset: pop.preset.code,
              heading: pop.heading,
              note: pop.note,
              qrSize: pop.qr.code,
              qrSvg,
            }}
          />
        </div>
        <PrintTrigger />
      </div>
    </main>
  );
}
