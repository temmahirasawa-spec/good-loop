import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 店舗編集モーダル（設定・店舗管理）の店名検索先（docs/setup-tasks.md 3）。
 * `GOOGLE_PLACES_API_KEY` はサーバー側だけで使う（NEXT_PUBLIC_を付けない）。
 *
 * ログイン中のユーザーだけが叩けるようにする（未ログインからの乱用・課金消費を防ぐ）。
 * Places API (New) の Text Search を使用。
 */

type PlaceCandidate = { placeId: string; name: string; address: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (query === "") {
    return NextResponse.json({ candidates: [] satisfies PlaceCandidate[] });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 500 });
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, languageCode: "ja", regionCode: "JP" }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "places search failed" }, { status: 502 });
  }

  const data: { places?: { id: string; displayName?: { text: string }; formattedAddress?: string }[] } = await res.json();
  const candidates: PlaceCandidate[] = (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
  }));

  return NextResponse.json({ candidates });
}
