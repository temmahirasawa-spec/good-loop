import type { CheckInput, CheckQuestion } from "./types";

/**
 * エリア×ジャンルから、AIに投げる現実的な質問を組み立てる
 * （docs/prototypes/ai-visibility-checker.html の runLive と同じ3問）。
 *
 * 質問文は来店客ではなく「お店を探している人」の口調にする。
 * ここを変えると計測の意味が変わるため、変更するときは天真に確認すること。
 */

export const DEFAULT_AREA = "神戸";
export const DEFAULT_GENRE = "カフェ";

/** 入力の空欄を既定値で埋め、前後の空白を落とす */
export function normalizeInput(input: CheckInput): CheckInput {
  return {
    storeName: input.storeName.trim(),
    area: input.area.trim() || DEFAULT_AREA,
    genre: input.genre.trim() || DEFAULT_GENRE,
  };
}

export function buildQuestions(input: CheckInput): CheckQuestion[] {
  const { area, genre } = normalizeInput(input);

  return [
    `${area} ${genre} おすすめ`,
    `${area}で人気の${genre}を教えて`,
    `${area} ${genre} 隠れた名店`,
  ].map((text, index) => ({ index, text, engine: "Claude" as const }));
}

/** 入力画面のティッカーに流す質問の例。実際の計測には使わない */
export const SAMPLE_QUESTIONS = [
  "「三宮 パンケーキ おすすめ」",
  "「梅田 焼肉 個室があるお店」",
  "「神戸 モーニング おすすめ」",
  "「元町 デートに使えるレストラン」",
  "「三宮 子連れで行けるカフェ」",
];
