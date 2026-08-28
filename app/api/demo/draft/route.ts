import Anthropic from "@anthropic-ai/sdk";
import {
  DRAFT_MAX_TOKENS,
  FOLLOWUP_FALLBACK,
  FOLLOWUP_MAX_TOKENS,
  FOLLOWUP_MODEL,
  FOLLOWUP_SYSTEM_PROMPT,
  buildFollowupUserPrompt,
  type FollowupReason,
  DRAFT_MODEL,
  DRAFT_SYSTEM_PROMPT,
  LIVE_MAX_TOKENS,
  LIVE_MODEL,
  LIVE_SYSTEM_PROMPT,
  buildDraftUserPrompt,
  buildLiveUserPrompt,
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

  const body = (await req.json().catch(() => null)) as
    | (DraftInput & {
        seed?: number;
        mode?: "live" | "final" | "followup";
        written_so_far?: string;
        reason?: FollowupReason;
      })
    | null;
  if (!body || !Array.isArray(body.picked)) {
    return new Response("invalid request body", { status: 400 });
  }

  // AI追質問（docs/specs/survey-v2.md 追記参照）。ストリーミング不要なのでJSONで返す
  if (body.mode === "followup") {
    const reason = body.reason ?? "vague-item";
    const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    try {
      const message = await anthropicClient.messages.create(
        {
          model: FOLLOWUP_MODEL,
          max_tokens: FOLLOWUP_MAX_TOKENS,
          system: FOLLOWUP_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildFollowupUserPrompt(body.picked, reason) }],
        },
        { timeout: 6000, maxRetries: 0 }
      );
      const block = message.content.find((b) => b.type === "text");
      const parsed = JSON.parse(block && "text" in block ? block.text : "") as {
        question?: unknown;
        choices?: unknown;
      };
      if (
        typeof parsed.question === "string" &&
        Array.isArray(parsed.choices) &&
        parsed.choices.every((c) => typeof c === "string")
      ) {
        return Response.json({ question: parsed.question, choices: parsed.choices });
      }
      throw new Error("unexpected shape");
    } catch {
      // AIが落ちても質問は出す（固定の文面に退避）
      return Response.json(FOLLOWUP_FALLBACK[reason]);
    }
  }

  // live = 質問中の書き足し（速い Haiku）／ final = 最後の仕上げ（Sonnet）
  const live = body.mode === "live";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const message = anthropic.messages.stream({
          model: live ? LIVE_MODEL : DRAFT_MODEL,
          max_tokens: live ? LIVE_MAX_TOKENS : DRAFT_MAX_TOKENS,
          temperature: 1,
          system: live ? LIVE_SYSTEM_PROMPT : DRAFT_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: live
                ? buildLiveUserPrompt(body.written_so_far ?? "", body.picked, body.written, body.tone)
                : buildDraftUserPrompt(body, body.seed ?? 1),
            },
          ],
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
