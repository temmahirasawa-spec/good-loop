import { NextResponse } from "next/server";
import { hashClientIp } from "@/lib/ai-check/rate-limit";
import { sendLowRatingAlert } from "@/lib/rating-flow/low-rating-alert";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSurveyStopped } from "@/lib/billing/survey-gate";
import { checkSurveyLimit, recordSurveyRequest } from "@/lib/survey/request-limit";
import { isV5FieldId, OTHER_FIELD, v5Topic } from "@/lib/survey/v5-topics";

/**
 * v5 の回答の保存先（docs/specs/survey-v5.md §7、supabase/0019）。
 *
 * 来店客はログインしないため admin client（service_role）で書き込む（rating-flow.md 前提節）。
 *
 * **★で行き先を決めない。** 届け先（google / store）は来店客が選んだものをそのまま保存する。
 * branch（good / improve）は管理画面の絞り込みのために★から導いて入れるだけ（「★の帯」）。
 *
 * 呼ばれるのは「届ける」とき1回だけ：
 *   - Google … 「この文章をコピー」か「Googleマップを開く」を押したとき（画面は Google を先に開き、これを待たない）
 *   - お店   … 「とどける」「この文章をお店に届ける」を押したとき（画面は保存できたのを見てから完了へ進む）
 * Googleで「コピー」→「開く」と進んだ人の2つ目の記録は /api/rating-flow/track-event に送る。
 *
 * ★3以下は低評価アラートの対象（supabase/0015）。v5 は届け先によってメールの文面を分ける。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1つの欄の上限（文字）。画面の欄は5行なので十分に大きい */
const MAX_FIELD_CHARS = 600;
/** 完成した文章の上限（文字） */
const MAX_FINAL_CHARS = 4000;

type Destination = "google" | "store";

type Parsed = {
  storeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  destination: Destination;
  wrote: boolean;
  topics: string[];
  fields: Record<string, string>;
  finalText: string;
  aiJoined: boolean;
  copied: boolean;
  openedGoogle: boolean;
};

function chars(text: string): number {
  return Array.from(text).length;
}

function parse(body: unknown): Parsed | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.storeId !== "string" || b.storeId === "" || b.storeId.length > 64) return null;
  if (typeof b.rating !== "number" || !Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) return null;
  if (b.destination !== "google" && b.destination !== "store") return null;
  if (typeof b.wrote !== "boolean") return null;

  // 話題は v5 の id だけ（「その他」は欄であって話題ではない）。重複と、知らない id は弾く
  if (!Array.isArray(b.topics) || b.topics.length > 6) return null;
  const topics: string[] = [];
  for (const t of b.topics) {
    if (typeof t !== "string" || t === OTHER_FIELD.id || !isV5FieldId(t) || topics.includes(t)) return null;
    topics.push(t);
  }

  const fields: Record<string, string> = {};
  if (b.fields !== undefined) {
    if (typeof b.fields !== "object" || b.fields === null || Array.isArray(b.fields)) return null;
    for (const [id, value] of Object.entries(b.fields as Record<string, unknown>)) {
      if (!isV5FieldId(id) || typeof value !== "string") return null;
      const text = value.trim();
      if (chars(text) > MAX_FIELD_CHARS) return null;
      if (text !== "") fields[id] = text;
    }
  }

  const finalText = typeof b.finalText === "string" ? b.finalText.trim() : "";
  if (chars(finalText) > MAX_FINAL_CHARS) return null;

  return {
    storeId: b.storeId,
    rating: b.rating as Parsed["rating"],
    destination: b.destination,
    wrote: b.wrote,
    topics,
    fields,
    finalText,
    aiJoined: b.aiJoined === true,
    copied: b.copied === true,
    openedGoogle: b.openedGoogle === true,
  };
}

export async function POST(request: Request) {
  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "invalid request body" }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 回数の上限。数えられないときは通す（お客様の回答を落とさないほうを取る。lib/survey/request-limit.ts）
  let ipHash: string | null = null;
  try {
    ipHash = hashClientIp(request);
  } catch {
    console.error("[survey-v5] AI_CHECK_IP_SALT が無いので、回答の回数の上限を数えられない");
  }
  if (ipHash) {
    const limit = await checkSurveyLimit(supabase, ipHash, "response");
    if (!limit.allowed && limit.reason !== "unavailable") {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, tenant_id")
    .eq("id", body.storeId)
    .maybeSingle();
  if (storeError || !store) {
    return NextResponse.json({ error: "store not found" }, { status: 404 });
  }
  // アンケートがお休みの契約先には回答を受け付けない（画面だけ止めても、ここを直接呼ばれると回答できてしまう。docs/specs/billing.md §3-8）
  if (await isSurveyStopped(supabase, store.tenant_id)) {
    return NextResponse.json({ error: "survey paused" }, { status: 403 });
  }

  const wroteSomething = body.wrote && (body.finalText !== "" || Object.keys(body.fields).length > 0);

  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      tenant_id: store.tenant_id,
      store_id: store.id,
      rating: body.rating,
      // ★の帯（管理画面の絞り込み用）。行き先は destination で、★とは関係ない
      branch: body.rating >= 4 ? "good" : "improve",
      free_text: wroteSomething && body.finalText !== "" ? body.finalText : null,
      flow: "v5",
      destination: body.destination,
      wrote: wroteSomething,
      topics: body.topics,
      fields: wroteSomething && Object.keys(body.fields).length > 0 ? body.fields : null,
      ai_joined: wroteSomething ? body.aiJoined : null,
    })
    .select("id")
    .single();
  if (responseError || !response) {
    console.error("[survey-v5] 回答を保存できなかった", responseError?.message);
    return NextResponse.json({ error: "failed to save response" }, { status: 500 });
  }

  if (ipHash) await recordSurveyRequest(supabase, ipHash, "response");

  // 送客の記録（管理画面の送客数・送客率の元データ。launch-plan.md C節）
  const events = [
    ...(body.destination === "google" && body.copied ? (["copied_draft"] as const) : []),
    ...(body.destination === "google" && body.openedGoogle ? (["opened_google"] as const) : []),
  ];
  if (events.length > 0) {
    await supabase
      .from("conversion_events")
      .insert(
        events.map((eventType) => ({
          tenant_id: store.tenant_id,
          store_id: store.id,
          survey_response_id: response.id,
          event_type: eventType,
        })),
      )
      .then(
        () => {},
        () => {},
      );
  }

  // ⚠ 来店客は目の前で待っている。sendLowRatingAlert は例外を投げず、送信にも上限時間がある（lib/email/send.ts）
  await sendLowRatingAlert({
    supabase,
    storeId: store.id,
    rating: body.rating,
    tags: body.topics.map((id) => v5Topic(id)?.label ?? id),
    freeText: wroteSomething ? body.finalText : "",
    destination: body.destination,
  });

  return NextResponse.json({ responseId: response.id });
}
