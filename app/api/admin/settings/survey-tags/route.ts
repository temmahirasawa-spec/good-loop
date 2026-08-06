import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 設定（アンケート項目）の保存先（launch-plan.md 決定②、supabase/0005参照）。
 *
 * ログイン中ユーザーのセッションを積んだクライアントで操作するため、RLS
 * （supabase/0005「store_tags: tenant isolation」）が自分のテナントの行にしか
 * 触れないことを保証する。追加分だけinsert・外れた分だけdeleteの差分更新。
 *
 * 既に回答（response_tags）で使われているタグは `on delete restrict` により削除できない。
 * その場合は409を返し、クライアント側でその1件だけ元に戻す。
 */

const MAX_TAGS = 8;

type Body = { storeId: string; category: "good" | "improve"; labels: string[] };

function isValidBody(body: unknown): body is Body {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.storeId === "string" &&
    (b.category === "good" || b.category === "improve") &&
    Array.isArray(b.labels) &&
    b.labels.length <= MAX_TAGS &&
    b.labels.every((l) => typeof l === "string" && l.trim() !== "")
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
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: current } = await supabase
    .from("store_tags")
    .select("id, label")
    .eq("store_id", body.storeId)
    .eq("category", body.category)
    .returns<{ id: string; label: string }[]>();

  const currentRows = current ?? [];
  const nextLabels = new Set(body.labels);
  const currentLabels = new Set(currentRows.map((t) => t.label));

  const toRemove = currentRows.filter((t) => !nextLabels.has(t.label));
  const toAdd = body.labels.filter((label) => !currentLabels.has(label));

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("store_tags")
      .delete()
      .in("id", toRemove.map((t) => t.id));
    if (deleteError) {
      return NextResponse.json({ error: "既に回答で使われているタグは削除できません" }, { status: 409 });
    }
  }

  if (toAdd.length > 0) {
    const baseOrder = currentRows.length;
    const { error: insertError } = await supabase.from("store_tags").insert(
      toAdd.map((label, i) => ({
        tenant_id: tenantId,
        store_id: body.storeId,
        category: body.category,
        label,
        sort_order: baseOrder + i,
      }))
    );
    if (insertError) {
      return NextResponse.json({ error: "failed to add tags" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
