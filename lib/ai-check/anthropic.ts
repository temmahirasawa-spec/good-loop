import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI視認性チェッカーが使う Anthropic クライアントと、モデル・ツールの版。
 *
 * ⚠ `server-only` を先頭に置いている。これを import した時点でクライアント側の
 *   バンドルに入るとビルドが落ちるので、APIキーが誤ってブラウザへ出ることを機構的に防ぐ。
 *
 * ── モデルとツールの版について ────────────────────────────
 * docs/prototypes/ai-visibility-checker.html は `claude-sonnet-4-6` ＋
 * `web_search_20250305` を claude.ai のプレビュー内で使っていた。本番では:
 *
 *   モデル      claude-haiku-4-5-20251001
 *               2026-08-17 天真の決定（費用を抑えるため）。
 *               既存の lib/rating-flow/generate-draft.ts と同じ版を使う。
 *
 *   Web検索     web_search_20250305
 *               新しい web_search_20260209（動的フィルタ付き）は
 *               Opus 4.6 / Sonnet 4.6 以降でしか使えない。**Haiku 4.5 では基本版が正しい。**
 *
 *   effort / thinking は Haiku 4.5 では未対応（送ると 400）。付けないこと。
 */

export const ASK_MODEL = "claude-haiku-4-5-20251001";
export const JUDGE_MODEL = "claude-haiku-4-5-20251001";
export const WEB_SEARCH_TOOL_TYPE = "web_search_20250305" as const;

/**
 * プロンプトの版。**プロンプトを直したら必ず上げること。**
 * キャッシュのキー（lib/ai-check/cache.ts）に含まれているので、
 * 上げるだけで古い応答が使われなくなる。
 */
export const ASK_PROMPT_VERSION = "v1";
export const JUDGE_PROMPT_VERSION = "v1";

/** 1問あたりのWeb検索の回数上限。Web検索は1,000回で $10 かかるため必ず上限を切る */
export const WEB_SEARCH_MAX_USES = 3;

/** サーバー側のタイムアウト（ミリ秒）。TypeScript SDK の timeout はミリ秒指定 */
export const ASK_TIMEOUT_MS = 120_000;
export const JUDGE_TIMEOUT_MS = 30_000;

/**
 * Web検索は10往復で `pause_turn` を返して一旦止まる。
 * 会話を継ぎ足して再開する回数の上限（無限に伸びないよう必ず切る）。
 */
export const MAX_CONTINUATIONS = 2;

/** ANTHROPIC_API_KEY が無いときに投げる。ビルドは壊さず、実行時にだけ落とす */
export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured");
    this.name = "MissingApiKeyError";
  }
}

/**
 * クライアントを作る。**モジュールの読み込み時ではなく、リクエストのたびに呼ぶこと。**
 * モジュールの最上位で `process.env.ANTHROPIC_API_KEY!` を読むと、
 * 鍵が無い環境でビルドが壊れる。
 */
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();

  return new Anthropic({ apiKey, maxRetries: 0 });
}

/**
 * 応答からテキストブロックだけを取り出して連結する。
 *
 * ⚠ 区切り文字を入れずに連結すること。Web検索を使うと、出典が挟まる位置で
 *   1つの文章が複数のテキストブロックに分割される（「1. 」と「店名 — 理由」が別ブロックになる）。
 *   ここで改行を挟むと、抜粋の箇条書きが1行ずつ崩れる（2026-08-17 実測で確認）。
 */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * `pause_turn`（サーバー側ツールの往復上限）が返ったら、
 * 直前の応答をそのまま会話に足して続きを取りに行く。
 */
export async function createWithContinuations(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { timeout: number }
): Promise<Anthropic.Message> {
  let message = await client.messages.create(params, options);
  let messages = params.messages;

  for (let i = 0; i < MAX_CONTINUATIONS && message.stop_reason === "pause_turn"; i++) {
    messages = [...messages, { role: "assistant", content: message.content }];
    message = await client.messages.create({ ...params, messages }, options);
  }

  return message;
}
