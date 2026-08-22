import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOOP_THEMES, BUSINESS_CATEGORIES } from "@/lib/admin/constants";
import { isValidSlug } from "@/lib/admin/store-slug";
import { getStoreQuotaState } from "@/lib/admin/store-quota";

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
 */

const VALID_THEMES = new Set(LOOP_THEMES.map((t) => t.slug));
const VALID_CATEGORIES = new Set(BUSINESS_CATEGORIES.map((c) => c.slug));

type Body = { name: string; loopTheme: string; businessCategory: string; slug: string; googlePlaceId?: string };

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

  return NextResponse.json({ store: data });
}
