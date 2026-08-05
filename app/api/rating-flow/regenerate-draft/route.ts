import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateDraftAndLog } from "@/lib/rating-flow/generate-draft";

/**
 * 03画面「再生成」の送信先（rating-flow.md A-6）。上限5回はクライアント側（DraftResult.tsx の
 * REGENERATE_LIMIT）で既に守られているが、サーバー側でも念のため検証する。
 */

const REGENERATE_LIMIT = 5;

type Body = {
  responseId: string;
  rating: 4 | 5;
  tags: string[];
  freeText: string;
  regenerateCount: number;
};

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.responseId === "string" &&
    (b.rating === 4 || b.rating === 5) &&
    Array.isArray(b.tags) &&
    b.tags.every((t) => typeof t === "string") &&
    typeof b.freeText === "string" &&
    typeof b.regenerateCount === "number"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  if (body.regenerateCount >= REGENERATE_LIMIT) {
    return NextResponse.json({ error: "regenerate limit reached" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: response, error } = await supabase
    .from("survey_responses")
    .select("tenant_id")
    .eq("id", body.responseId)
    .maybeSingle();
  if (error || !response) {
    return NextResponse.json({ error: "response not found" }, { status: 404 });
  }

  const draft = await generateDraftAndLog({
    tenantId: response.tenant_id,
    responseId: body.responseId,
    rating: body.rating,
    tags: body.tags,
    freeText: body.freeText,
    regenerateCount: body.regenerateCount + 1,
  });

  return NextResponse.json({ draft });
}
