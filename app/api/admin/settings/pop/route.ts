import { NextResponse } from "next/server";
import { refuseWhenPaused } from "@/lib/billing/state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPopColor, isPopDesign, isPopOrientation, isPopQrSize, POP_MAX_HEADING, POP_MAX_NOTE } from "@/lib/admin/pop";

/**
 * 卓上POPの設定の保存先（supabase/0012・0018。2026-09-29 名刺サイズに作り直した）。
 *
 * ログイン中ユーザーのセッションで stores を更新する。RLS（supabase/0002）が
 * 他テナントの店舗を書き換えられないことを保証するので、admin client は使わない。
 */

type Body = {
  storeId: string;
  orientation: string;
  design: string;
  color: string;
  heading: string;
  note: string;
  qrSize: string;
  showStoreLogo: boolean;
  showBrandLogo: boolean;
};

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeId === "string" &&
    isPopOrientation(b.orientation) &&
    isPopDesign(b.design) &&
    isPopColor(b.color) &&
    isPopQrSize(b.qrSize) &&
    typeof b.heading === "string" &&
    b.heading.length <= POP_MAX_HEADING &&
    typeof b.note === "string" &&
    // A6 のころの長い本文（最大200字）が残っている店舗もあるので、画面の上限より長くても受け付けて切り詰める
    b.note.length <= 200 &&
    typeof b.showStoreLogo === "boolean" &&
    typeof b.showBrandLogo === "boolean"
  );
}

export async function PUT(request: Request) {
  // お休み（見るだけ）のあいだは設定を変えさせない（docs/specs/billing.md §3-8）
  const paused = await refuseWhenPaused();
  if (paused) return paused;

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const heading = body.heading.trim();
  const note = body.note.trim().slice(0, POP_MAX_NOTE);
  const { data, error } = await supabase
    .from("stores")
    .update({
      pop_orientation: body.orientation,
      pop_design: body.design,
      pop_color: body.color,
      // 空のまま保存したら既定の文言に戻す（null＝未設定）
      pop_heading: heading === "" ? null : heading,
      pop_note: note === "" ? null : note,
      pop_qr_size: body.qrSize,
      pop_show_store_logo: body.showStoreLogo,
      pop_show_brand_logo: body.showBrandLogo,
    })
    .eq("id", body.storeId)
    .select("id");

  // RLS で他テナントの店舗は0件更新になる（エラーにはならない）。0件も失敗として返す
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
