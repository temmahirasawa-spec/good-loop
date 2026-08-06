import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 「＋ 店舗を追加」（launch-plan.md、2026-08-06決定）のURLスラッグ自動生成。
 *
 * 日本語の店舗名を単純なルールでローマ字化するのは困難なため、既に
 * ANTHROPIC_API_KEY が登録済みであることを利用してClaude Haikuにローマ字化させる
 * （lib/rating-flow/generate-draft.ts と同じモデル・同じフォールバック方針）。
 * 失敗時は時刻ベースの機械的なスラッグにフォールバックする（並びは悪いが必ず動く）。
 */

const MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 5000;

function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 1 && slug.length <= 60;
}

async function romanize(storeName: string): Promise<string | null> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 40,
        system:
          "日本語の店舗名を、URLに使えるローマ字スラッグに変換します。小文字の半角英数字とハイフンだけを出力してください。説明や前置きは一切書かず、スラッグ本体だけを出力してください。",
        messages: [{ role: "user", content: storeName }],
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 }
    );
    const block = message.content.find((b) => b.type === "text");
    if (!block || !("text" in block)) return null;
    const cleaned = sanitize(block.text);
    return cleaned || null;
  } catch {
    return null;
  }
}

/** 店舗名からスラッグ候補を1つ作る（重複解決はしない） */
export async function suggestSlug(storeName: string): Promise<string> {
  const romanized = await romanize(storeName);
  if (romanized) return romanized;
  return `store-${Date.now()}`;
}

/** 候補が既存と衝突する場合、-2, -3 ... を付けて空いているものを返す */
export async function ensureUniqueSlug(supabase: SupabaseClient, baseSlug: string): Promise<string> {
  for (let suffix = 1; suffix < 50; suffix++) {
    const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const { data } = await supabase.from("stores").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}
