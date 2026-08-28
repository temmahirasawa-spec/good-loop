import Anthropic from "@anthropic-ai/sdk";
import {
  CHOICES_MAX_TOKENS,
  CHOICES_MODEL,
  CHOICES_SYSTEM_PROMPT,
  FINAL_MAX_TOKENS,
  FINAL_MODEL,
  FOLLOWUP_FALLBACK,
  FOLLOWUP_MAX_TOKENS,
  FOLLOWUP_MODEL,
  FOLLOWUP_SYSTEM_PROMPT,
  REFINE_MAX_TOKENS,
  REFINE_MODEL,
  REFINE_SYSTEM_PROMPT,
  buildChoicesUserPrompt,
  buildFollowupUserPrompt,
  buildRefineUserPrompt,
  type FollowupReason,
  type SignalInput,
} from "@/lib/demo/draft-prompt";

/**
 * アンケート v2 プロトタイプの生成API（docs/specs/survey-v2.md §12）。
 *
 * **検証専用。DBには一切書き込まない。ai_draft_logs にも入れない。**
 *
 * | mode | モデル | 何をするか |
 * |---|---|---|
 * | refine | Haiku | 章の事実を、前の文章につながる続きとして整文（JSON） |
 * | final | Sonnet | 全事実から下書き全体を整文（JSON） |
 * | choices | Haiku | 品名から感想の選択肢を作る（肯定・中立・否定をバランス） |
 * | followup | Haiku | 足りない情報をひとつだけ聞く質問を作る |
 *
 * **★（総合評価）はどのmodeにも渡さない。** 文の検証（sourceSignalIds・禁止語・メタ発言）は
 * クライアント側の validateSentences が行う。通らなければクライアントは直前の文章を維持する。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** モデルがコードフェンスや前置きを付けてもJSONを取り出す */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(text.slice(start, end + 1));
}

type Body = {
  mode?: "refine" | "final" | "choices" | "followup";
  signals?: SignalInput[];
  previousText?: string;
  tone?: "normal" | "casual";
  seed?: number;
  itemLabel?: string;
  categoryLabel?: string;
  reason?: FollowupReason;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.mode) return Response.json({ error: "invalid body" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (body.mode === "choices") {
    try {
      const message = await anthropic.messages.create(
        {
          model: CHOICES_MODEL,
          max_tokens: CHOICES_MAX_TOKENS,
          system: CHOICES_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildChoicesUserPrompt(body.itemLabel ?? "", body.categoryLabel ?? "") }],
        },
        { timeout: 8000, maxRetries: 0 }
      );
      const block = message.content.find((b) => b.type === "text");
      const parsed = extractJson(block && "text" in block ? block.text : "") as { choices?: unknown };
      if (
        Array.isArray(parsed.choices) &&
        parsed.choices.length >= 3 &&
        parsed.choices.every(
          (c) => typeof c === "object" && c !== null && typeof (c as { label?: unknown }).label === "string"
        )
      ) {
        return Response.json({ choices: parsed.choices.slice(0, 8) });
      }
      throw new Error("unexpected shape");
    } catch (error) {
      console.error("[demo] 選択肢の生成に失敗", error);
      return Response.json({ choices: null }); // クライアントがカテゴリ別の固定リストに退避する
    }
  }

  if (body.mode === "followup") {
    const reason = body.reason ?? "vague-item";
    try {
      const message = await anthropic.messages.create(
        {
          model: FOLLOWUP_MODEL,
          max_tokens: FOLLOWUP_MAX_TOKENS,
          system: FOLLOWUP_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildFollowupUserPrompt(body.signals ?? [], reason) }],
        },
        { timeout: 6000, maxRetries: 0 }
      );
      const block = message.content.find((b) => b.type === "text");
      const parsed = extractJson(block && "text" in block ? block.text : "") as { question?: unknown; choices?: unknown };
      if (typeof parsed.question === "string" && Array.isArray(parsed.choices) && parsed.choices.every((c) => typeof c === "string")) {
        return Response.json({ question: parsed.question, choices: parsed.choices });
      }
      throw new Error("unexpected shape");
    } catch (error) {
      console.error("[demo] 追質問の生成に失敗", error);
      return Response.json(FOLLOWUP_FALLBACK[reason]);
    }
  }

  // refine / final
  const signals = body.signals ?? [];
  if (signals.length === 0) {
    // 新しい事実が無ければ呼ばれない設計だが、来ても生成しない（P0: 空の追加生成をしない）
    return Response.json({ sentences: [] });
  }
  const isFinal = body.mode === "final";
  try {
    const message = await anthropic.messages.create(
      {
        model: isFinal ? FINAL_MODEL : REFINE_MODEL,
        max_tokens: isFinal ? FINAL_MAX_TOKENS : REFINE_MAX_TOKENS,
        temperature: 1,
        system: REFINE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildRefineUserPrompt({
              signals,
              previousText: body.previousText ?? "",
              tone: body.tone ?? "normal",
              seed: body.seed ?? 1,
              mode: isFinal ? "final" : "refine",
            }),
          },
        ],
      },
      { timeout: 15000, maxRetries: 0 }
    );
    const block = message.content.find((b) => b.type === "text");
    const parsed = extractJson(block && "text" in block ? block.text : "") as { sentences?: unknown };
    if (
      Array.isArray(parsed.sentences) &&
      parsed.sentences.every(
        (s) =>
          typeof s === "object" && s !== null &&
          typeof (s as { text?: unknown }).text === "string" &&
          Array.isArray((s as { sourceSignalIds?: unknown }).sourceSignalIds)
      )
    ) {
      return Response.json({ sentences: parsed.sentences });
    }
    throw new Error("unexpected shape");
  } catch (error) {
    // 技術的な詳細はログだけ。画面には出さない（クライアントは直前の文章を維持する）
    console.error("[demo] 整文に失敗", error);
    return Response.json({ sentences: null });
  }
}
