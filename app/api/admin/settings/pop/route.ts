import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POP_PRESETS, POP_QR_SIZES } from "@/lib/admin/pop";

/**
 * 卓上POPの設定の保存先（supabase/0012、2026-08-22）。
 *
 * ログイン中ユーザーのセッションで stores を更新する。RLS（supabase/0002）が
 * 他テナントの店舗を書き換えられないことを保証するので、admin client は使わない。
 */

const PRESETS = new Set<string>(POP_PRESETS.map((p) => p.code));
const SIZES = new Set<string>(POP_QR_SIZES.map((s) => s.code));
const MAX_HEADING = 40;
const MAX_NOTE = 200;

type Body = { storeId: string; preset: string; heading: string; note: string; qrSize: string };

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeId === "string" &&
    typeof b.preset === "string" &&
    PRESETS.has(b.preset) &&
    typeof b.qrSize === "string" &&
    SIZES.has(b.qrSize) &&
    typeof b.heading === "string" &&
    b.heading.length <= MAX_HEADING &&
    typeof b.note === "string" &&
    b.note.length <= MAX_NOTE
  );
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("stores")
    .update({
      pop_preset: body.preset,
      // 空のまま保存したらプリセットの既定文言に戻す（null＝未設定）
      pop_heading: body.heading.trim() === "" ? null : body.heading.trim(),
      pop_note: body.note.trim() === "" ? null : body.note,
      pop_qr_size: body.qrSize,
    })
    .eq("id", body.storeId);

  if (error) {
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
