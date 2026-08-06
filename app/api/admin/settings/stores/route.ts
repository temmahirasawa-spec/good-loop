import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOOP_THEMES } from "@/lib/admin/constants";
import { isValidSlug } from "@/lib/admin/store-slug";

/**
 * 「＋ 店舗を追加」モーダルの保存先（store-add-modal, 2026-08-06決定）。
 * ログイン中ユーザーのセッションクライアントで insert する。RLS
 * （supabase/0002「stores: tenant isolation」）が tenant_id の詐称を防ぐ。
 */

const VALID_THEMES = new Set(LOOP_THEMES.map((t) => t.slug));

type Body = { name: string; loopTheme: string; slug: string; googlePlaceId?: string };

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === "string" &&
    b.name.trim() !== "" &&
    typeof b.loopTheme === "string" &&
    VALID_THEMES.has(b.loopTheme) &&
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
      ...(body.googlePlaceId ? { google_place_id: body.googlePlaceId } : {}),
    })
    .select("id, name, slug, loop_theme")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "このURLは既に使われています。編集してやり直してください" }, { status: 409 });
    }
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ store: data });
}
