import Anthropic from "@anthropic-ai/sdk";
import {
  DRAFT_MAX_TOKENS,
  DRAFT_MODEL,
  DRAFT_SYSTEM_PROMPT,
  buildDraftUserPrompt,
  type DraftInput,
} from "@/lib/demo/draft-prompt";

/**
 * アンケート v2 プロトタイプの下書き生成（docs/specs/survey-v2.md 段1）。
 *
 * **検証専用。DBには一切書き込まない**（本番の /api/rating-flow/responses とは別物）。
 * 生成の記録も残さないので、`ai_draft_logs` にも入らない。
 *
 * **文字を少しずつ返す**（ストリーミング）。器のタイピング演出を「本物」にするため。
 * ここが偽物のアニメーションだと、待ち時間がただの遅延になる。
 *
 * モデルは Sonnet（`DRAFT_MODEL`）。本番の下書きは Haiku だが、
 * **Haiku は定型的な言い回しに寄りやすく、それが「AIが書いた感想文」に見える一因**
 * だった（2026-08-28、FROMAでステマと書かれた件の分析）。ここでは品質を優先する。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY が設定されていません", { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as (DraftInput & { seed?: number }) | null;
  if (!body || !Array.isArray(body.picked)) {
    return new Response("invalid request body", { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const message = anthropic.messages.stream({
          model: DRAFT_MODEL,
          max_tokens: DRAFT_MAX_TOKENS,
          temperature: 1,
          system: DRAFT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildDraftUserPrompt(body, body.seed ?? 1) }],
        });
        for await (const event of message) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        console.error("[demo] 下書きの生成に失敗", error);
        controller.enqueue(encoder.encode("（下書きを作れませんでした。もう一度お試しください）"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
