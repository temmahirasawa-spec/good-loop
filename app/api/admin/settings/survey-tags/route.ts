import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 設定（アンケート項目）の保存先（launch-plan.md 決定②、supabase/0005・0016参照）。
 *
 * ログイン中ユーザーのセッションを積んだクライアントで操作するため、RLS
 * （supabase/0005「store_tags: tenant isolation」）が自分のテナントの行にしか
 * 触れないことを保証する。
 *
 * 2026-08-24、**アーカイブ方式**に切り替えた（天真の決定。docs/specs/onboarding.md の
 * 既知の制約「回答が付いた項目は消せない」の解消）。過去の回答データは不変、が原則。
 *
 * | 操作 | 何が起きるか |
 * |---|---|
 * | 外した項目（回答あり） | **アーカイブ**（隠す）。過去の集計は集計画面に残る |
 * | 外した項目（回答なし） | 削除（残しても集計0件のノイズになるだけ） |
 * | 足した項目 | 同名のアーカイブがあれば**復元**（集計が続きから再開）。無ければ新規 |
 *
 * 復元を先にやるのは unique(store_id, category, label) 制約のため。
 * アーカイブ済みと同名を insert すると一意制約に当たる。
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

  // アーカイブ済みも含めて全部読む（復元の判定に要る）
  const { data: current } = await supabase
    .from("store_tags")
    .select("id, label, archived_at")
    .eq("store_id", body.storeId)
    .eq("category", body.category)
    .returns<{ id: string; label: string; archived_at: string | null }[]>();

  const rows = current ?? [];
  const active = rows.filter((t) => !t.archived_at);
  const archived = rows.filter((t) => t.archived_at);
  const nextLabels = new Set(body.labels);
  const activeLabels = new Set(active.map((t) => t.label));

  const toRemove = active.filter((t) => !nextLabels.has(t.label));
  const toAddLabels = body.labels.filter((label) => !activeLabels.has(label));
  // 同名のアーカイブがあれば復元。集計が「続きから」になる（作り直しで0からにしない）
  const toRestore = archived.filter((t) => toAddLabels.includes(t.label));
  const restoreLabels = new Set(toRestore.map((t) => t.label));
  const toInsert = toAddLabels.filter((label) => !restoreLabels.has(label));

  if (toRemove.length > 0) {
    // 回答が付いているものはアーカイブ、付いていないものは削除
    const removeIds = toRemove.map((t) => t.id);
    const { data: used } = await supabase
      .from("response_tags")
      .select("tag_id")
      .in("tag_id", removeIds)
      .returns<{ tag_id: string }[]>();
    const usedIds = new Set((used ?? []).map((u) => u.tag_id));
    const archiveIds = removeIds.filter((id) => usedIds.has(id));
    const deleteIds = removeIds.filter((id) => !usedIds.has(id));

    if (archiveIds.length > 0) {
      const { error } = await supabase
        .from("store_tags")
        .update({ archived_at: new Date().toISOString() })
        .in("id", archiveIds);
      if (error) return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
    }
    if (deleteIds.length > 0) {
      const { error } = await supabase.from("store_tags").delete().in("id", deleteIds);
      if (error) return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
    }
  }

  if (toRestore.length > 0) {
    const { error } = await supabase
      .from("store_tags")
      .update({ archived_at: null })
      .in("id", toRestore.map((t) => t.id));
    if (error) return NextResponse.json({ error: "保存できませんでした。もう一度お試しください。" }, { status: 500 });
  }

  if (toInsert.length > 0) {
    const baseOrder = active.length;
    const { error } = await supabase.from("store_tags").insert(
      toInsert.map((label, i) => ({
        tenant_id: tenantId,
        store_id: body.storeId,
        category: body.category,
        label,
        sort_order: baseOrder + i,
      }))
    );
    if (error) return NextResponse.json({ error: "failed to add tags" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
