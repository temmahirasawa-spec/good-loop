import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 03画面「①この文章をコピー」「②Googleマップを開く」の記録先（launch-plan.md C節）。
 * 管理画面の送客数・送客率の元データになる（`opened_google` の件数で送客数を数える）。
 *
 * 失敗しても来店客のフローを止める理由が無いため、呼び出し側（RatingFlow.tsx）は
 * レスポンスを待たずに送りっぱなしにする想定。ここでの失敗はログに残るだけでよい。
 */

type Body = {
  responseId: string;
  eventType: "copied_draft" | "opened_google";
};

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.responseId === "string" &&
    (b.eventType === "copied_draft" || b.eventType === "opened_google")
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .select("id, tenant_id, store_id")
    .eq("id", body.responseId)
    .maybeSingle();
  if (responseError || !response) {
    return NextResponse.json({ error: "response not found" }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("conversion_events").insert({
    tenant_id: response.tenant_id,
    store_id: response.store_id,
    survey_response_id: response.id,
    event_type: body.eventType,
  });
  if (insertError) {
    return NextResponse.json({ error: "failed to record event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
