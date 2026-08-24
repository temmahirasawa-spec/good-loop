import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateDraftAndLog } from "@/lib/rating-flow/generate-draft";
import { sendLowRatingAlert } from "@/lib/rating-flow/low-rating-alert";

/**
 * 02画面「回答する」（★4以上）／04画面「送信する」（★3以下）の送信先（rating-flow.md A-6）。
 *
 * 来店客はログインしないため admin client（service_role）で書き込む（rating-flow.md 前提節）。
 * ★4以上のときは、rating-flow.md A-1「評価・タグ・自由記述を送信、同時にAI下書き生成を開始」
 * のとおり、回答の保存とAI下書き生成を同じリクエストの中で行う。
 */

type Body = {
  storeId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  branch: "good" | "improve";
  tags: string[];
  freeText: string;
};

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeId === "string" &&
    typeof b.rating === "number" &&
    b.rating >= 1 &&
    b.rating <= 5 &&
    (b.branch === "good" || b.branch === "improve") &&
    Array.isArray(b.tags) &&
    b.tags.every((t) => typeof t === "string") &&
    typeof b.freeText === "string"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  // ★4以上はgood、★3以下はimproveで固定（rating-flow.md A-2）。branchとratingの矛盾を弾く
  const expectedBranch = body.rating >= 4 ? "good" : "improve";
  if (body.branch !== expectedBranch) {
    return NextResponse.json({ error: "rating and branch mismatch" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, tenant_id")
    .eq("id", body.storeId)
    .maybeSingle();
  if (storeError || !store) {
    return NextResponse.json({ error: "store not found" }, { status: 404 });
  }

  const { data: response, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      tenant_id: store.tenant_id,
      store_id: store.id,
      rating: body.rating,
      branch: body.branch,
      free_text: body.freeText.trim() || null,
    })
    .select("id")
    .single();
  if (responseError || !response) {
    return NextResponse.json({ error: "failed to save response" }, { status: 500 });
  }

  if (body.tags.length > 0) {
    const { data: matchedTags } = await supabase
      .from("store_tags")
      .select("id")
      .eq("store_id", store.id)
      .eq("category", body.branch)
      .in("label", body.tags);
    if (matchedTags && matchedTags.length > 0) {
      await supabase.from("response_tags").insert(
        matchedTags.map((t) => ({ tenant_id: store.tenant_id, response_id: response.id, tag_id: t.id }))
      );
    }
  }

  if (body.branch !== "good") {
    // ★3以下は低評価アラートの対象（supabase/0015）。
    //
    // ⚠ **来店客は目の前で送信ボタンを押して待っている。**
    //   `sendLowRatingAlert` は例外を投げず、送信自体にも上限時間を設けてあるので
    //   （lib/email/send.ts）、ここで待っても画面が固まり続けることはない。
    //   応答を返したあとに送る `after`（Next.js 15）はこの版では使えないため、
    //   **確実に送るほうを採った。** 15 に上げたら after へ移してよい。
    await sendLowRatingAlert({
      supabase,
      storeId: store.id,
      rating: body.rating,
      tags: body.tags,
      freeText: body.freeText,
    });
    return NextResponse.json({ responseId: response.id });
  }

  const draft = await generateDraftAndLog({
    tenantId: store.tenant_id,
    responseId: response.id,
    rating: body.rating as 4 | 5,
    tags: body.tags,
    freeText: body.freeText,
    regenerateCount: 0,
  });

  return NextResponse.json({ responseId: response.id, draft });
}
