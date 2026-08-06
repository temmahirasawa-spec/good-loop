import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { suggestSlug, ensureUniqueSlug } from "@/lib/admin/store-slug";

/**
 * 「＋ 店舗を追加」モーダルのURLプレビュー先（store-add-modal, 2026-08-06決定）。
 * 店舗名の入力中に呼ばれる（デバウンス済み・店舗編集モーダルの店名検索と同じ形）。
 * ここではまだ何も保存しない。実際の作成は POST /api/admin/settings/stores で行う。
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name === "") {
    return NextResponse.json({ slug: "" });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = await suggestSlug(name);
  const slug = await ensureUniqueSlug(supabase, base);
  return NextResponse.json({ slug });
}
