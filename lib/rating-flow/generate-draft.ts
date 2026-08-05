import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { composeFallbackDraft } from "./fallback-draft";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * AI下書き生成（docs/specs/rating-flow.md B節・案1、推奨案として決定済み）。
 * Claude Haiku 4.5・5秒タイムアウト・失敗時は案3（テンプレート合成）にフォールバックする。
 * 生成の成否は ai_draft_logs に記録する（失敗率・再生成率の可視化用）。
 */

const MODEL = "claude-haiku-4-5-20251001";
const PROMPT_VERSION = "v1";
const TIMEOUT_MS = 5000;
const MAX_TOKENS = 400;

const SYSTEM_PROMPT = `あなたは実店舗（飲食店・美容室・整骨院など）に対する、Googleクチコミの下書きを書くアシスタントです。
以下のルールを厳密に守ってください。

- 文体は「ですます調」。丁寧すぎず、カジュアルすぎない一般的な敬語で書く
- 200字程度の自然な日本語クチコミにする
- お客様が選んだ「良かった点」のタグと、書かれた自由記述の内容だけを根拠にする。
  タグにも自由記述にも無い具体的な事実（料理名・金額・時間など）を作り上げない
- 星評価が5のときは「また来たい」という気持ちを、星評価が4のときは「満足した」という気持ちを、
  押しつけがましくなく自然に含める
- クチコミ本文だけを出力する。前置き・後書き・カギ括弧・見出しは付けない
- 自分がAIであることには一切触れない`;

function buildUserPrompt(rating: 4 | 5, tags: string[], freeText: string): string {
  return [
    `評価: ★${rating}`,
    `良かった点: ${tags.length > 0 ? tags.join("、") : "（選択なし）"}`,
    `お客様の自由記述: ${freeText.trim() || "（記入なし）"}`,
    "",
    "上記をもとに、Googleクチコミの下書きを1つ書いてください。",
  ].join("\n");
}

export async function generateDraftAndLog({
  tenantId,
  responseId,
  rating,
  tags,
  freeText,
  regenerateCount,
}: {
  tenantId: string;
  responseId: string;
  rating: 4 | 5;
  tags: string[];
  freeText: string;
  regenerateCount: number;
}): Promise<{ text: string; status: "ready" | "fallback" }> {
  const start = Date.now();
  let text: string;
  let success: boolean;
  let fallbackUsed: boolean;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(rating, tags, freeText) }],
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 }
    );
    const block = message.content.find((b) => b.type === "text");
    if (!block || !("text" in block) || !block.text.trim()) throw new Error("empty response from Anthropic");
    text = block.text.trim();
    success = true;
    fallbackUsed = false;
  } catch {
    text = composeFallbackDraft(rating, tags, freeText);
    success = false;
    fallbackUsed = true;
  }

  const latencyMs = Date.now() - start;

  const supabase = createSupabaseAdminClient();
  await supabase.from("ai_draft_logs").insert({
    tenant_id: tenantId,
    response_id: responseId,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    output_text: text,
    latency_ms: latencyMs,
    success,
    fallback_used: fallbackUsed,
    regenerate_count: regenerateCount,
  });

  return { text, status: fallbackUsed ? "fallback" : "ready" };
}
