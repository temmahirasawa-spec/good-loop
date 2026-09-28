import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INDUSTRY_THEMES, BUSINESS_CATEGORIES } from "@/lib/admin/constants";
import { isValidSlug } from "@/lib/admin/store-slug";
import { getStoreQuotaState } from "@/lib/admin/store-quota";
import { generateQrSvg } from "@/lib/qr-code";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { checkPlaceLink } from "@/lib/billing/place-check";
import { getBillingState } from "@/lib/billing/state";

/**
 * 「＋ 店舗を追加」モーダルの保存先（store-add-modal, 2026-08-06決定）。
 * ログイン中ユーザーのセッションクライアントで insert する。RLS
 * （supabase/0002「stores: tenant isolation」）が tenant_id の詐称を防ぐ。
 *
 * 2026-08-06、業態（business_category）と色テーマ（loop_theme）を分離した
 * （supabase/0007参照）。両方とも必須で受け取る。
 *
 * 2026-08-21、**店舗枠のチェック**を追加した（supabase/0009）。契約している店舗数を
 * 超える追加は 402（お支払いが必要）で断る。DB側にも同じ判定のトリガーがあり、
 * ここをすり抜けても insert が失敗する（二重の防御。片方だけにしない）。
 *
 * 2026-09-28、無料体験の変更（docs/specs/billing.md §3）で2つ足した。
 *   - 体験中に、前に無料体験をしたお店を紐付けるときは 409 で確認を求める（Q4。`confirmPaid` で有料に切り替える）
 *   - カードを登録する前・お休みのあいだは、二次元コードを返さない（§3-2。店舗を作ること自体はできる）
 * 店舗の編集（PATCH）も、紐付けの判定のためにここを通す（以前はブラウザから直接 DB を書き換えていた）。
 */

const VALID_THEMES = new Set(INDUSTRY_THEMES.map((t) => t.slug));
const VALID_CATEGORIES = new Set(BUSINESS_CATEGORIES.map((c) => c.slug));

type Body = { name: string; loopTheme: string; businessCategory: string; slug: string; googlePlaceId?: string; confirmPaid?: boolean };

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === "string" &&
    b.name.trim() !== "" &&
    typeof b.loopTheme === "string" &&
    VALID_THEMES.has(b.loopTheme) &&
    typeof b.businessCategory === "string" &&
    VALID_CATEGORIES.has(b.businessCategory) &&
    typeof b.slug === "string" &&
    isValidSlug(b.slug) &&
    (b.googlePlaceId === undefined || (typeof b.googlePlaceId === "string" && b.googlePlaceId.trim() !== ""))
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const quota = await getStoreQuotaState();
  if (!quota.canAddStore) {
    return NextResponse.json(
      { error: "店舗枠が足りません。お支払い画面から店舗枠を追加してください。", code: "quota_exceeded" },
      { status: 402 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (body.googlePlaceId) {
    const check = await checkPlaceLink(tenantId, body.googlePlaceId, body.confirmPaid === true);
    if (!check.ok) {
      return NextResponse.json({ error: "trial already used for this place", needsPaidConfirmation: true, reason: "place", quote: check.quote }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      tenant_id: tenantId,
      name: body.name.trim(),
      slug: body.slug,
      loop_theme: body.loopTheme,
      business_category: body.businessCategory,
      ...(body.googlePlaceId ? { google_place_id: body.googlePlaceId } : {}),
    })
    .select("id, name, slug, loop_theme, business_category")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "このURLは既に使われています。編集してやり直してください" }, { status: 409 });
    }
    // 店舗枠のトリガー（supabase/0009 enforce_store_quota）。上のチェックをすり抜けた場合の受け皿。
    // 例: 同じ枠に対して2つのタブから同時に「追加」を押した
    if (error.message?.includes("store quota exceeded")) {
      return NextResponse.json(
        { error: "店舗枠が足りません。お支払い画面から店舗枠を追加してください。", code: "quota_exceeded" },
        { status: 402 }
      );
    }
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }

  // オンボーディングのステップ7（二次元コードができました）が、作成直後にQRを表示するため。
  // 店舗追加モーダルはこのフィールドを使わない（増えても無害）。
  // カードを登録する前・お休みのあいだは返さない（画面はカードの関門を出す。§3-2）
  const billing = await getBillingState();
  const qrSvg = billing.access.canUseStoreFeatures ? await generateQrSvg(`${PUBLIC_APP_URL}/r/${data.slug}`) : null;

  return NextResponse.json({ store: data, qrSvg, needsCard: billing.access.needsCard });
}

type EditBody = { storeId: string; name: string; businessCategory: string; googlePlaceId?: string; confirmPaid?: boolean };

function isValidEditBody(body: unknown): body is EditBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeId === "string" &&
    typeof b.name === "string" &&
    b.name.trim() !== "" &&
    typeof b.businessCategory === "string" &&
    VALID_CATEGORIES.has(b.businessCategory) &&
    (b.googlePlaceId === undefined || (typeof b.googlePlaceId === "string" && b.googlePlaceId.trim() !== ""))
  );
}

/**
 * 店舗の編集（Figma node 75:1416 PC / 76:1658 SP）。店名・業態・Google マップの紐付け。
 * ログイン中のセッションで更新するので、RLS がそのまま効く（他の契約先の店舗は書き換えられない）。
 */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidEditBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (body.googlePlaceId) {
    const check = await checkPlaceLink(tenantId, body.googlePlaceId, body.confirmPaid === true);
    if (!check.ok) {
      return NextResponse.json({ error: "trial already used for this place", needsPaidConfirmation: true, reason: "place", quote: check.quote }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from("stores")
    .update({
      name: body.name.trim(),
      business_category: body.businessCategory,
      ...(body.googlePlaceId ? { google_place_id: body.googlePlaceId } : {}),
    })
    .eq("id", body.storeId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: error ? 500 : 404 });
  }
  return NextResponse.json({ ok: true });
}
