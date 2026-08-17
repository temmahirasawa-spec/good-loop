import type { CheckQuestion, QuestionResult } from "./types";

/**
 * ブラウザから叩く計測API（POST /api/checker/ask）の呼び出し。
 *
 * **ここはクライアント側で動く。`server-only` を import しないこと。**
 * APIキーはサーバー側（lib/ai-check/anthropic.ts）だけが読む。
 */

export type AskResponse = {
  mentioned: boolean;
  position: number | null;
  matchedText: string | null;
  stores: string[];
  excerpt: string;
};

/** 失敗の種類。画面に出す文言を変えるために区別する */
export type AskFailure =
  /** そのIPの利用回数の上限に達した */
  | "rate_limited_ip"
  /** 全体の1日の上限に達した */
  | "rate_limited_global"
  /** 上限を数えられなかった等、一時的に受け付けられない */
  | "unavailable"
  /** AIの応答が取れなかった、その他 */
  | "failed";

export class AskError extends Error {
  readonly failure: AskFailure;

  constructor(failure: AskFailure) {
    super(`ask failed: ${failure}`);
    this.name = "AskError";
    this.failure = failure;
  }
}

async function failureOf(response: Response): Promise<AskFailure> {
  if (response.status === 503) return "unavailable";
  if (response.status !== 429) return "failed";

  const reason = await response
    .json()
    .then((body: { reason?: string }) => body.reason)
    .catch(() => undefined);

  return reason === "global" ? "rate_limited_global" : "rate_limited_ip";
}

/** 1問ぶんの計測を依頼する。失敗したら AskError を投げる */
export async function requestAsk(
  question: string,
  storeName: string,
  signal?: AbortSignal
): Promise<AskResponse> {
  const response = await fetch("/api/checker/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, storeName }),
    signal,
  });

  if (!response.ok) throw new AskError(await failureOf(response));

  return (await response.json()) as AskResponse;
}

/** 取得できなかった問。スコアの母数から外れる */
export function errorResult(question: CheckQuestion): QuestionResult {
  return {
    index: question.index,
    question: question.text,
    engine: question.engine,
    status: "error",
    mentioned: false,
    position: null,
    matchedText: null,
    stores: [],
    excerpt: "",
  };
}

export function doneResult(question: CheckQuestion, answer: AskResponse): QuestionResult {
  return {
    index: question.index,
    question: question.text,
    engine: question.engine,
    status: "done",
    mentioned: answer.mentioned,
    position: answer.position,
    matchedText: answer.matchedText,
    stores: answer.stores,
    excerpt: answer.excerpt,
  };
}
