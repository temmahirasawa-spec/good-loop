/**
 * AI視認性チェッカーが扱うデータの型（docs/plans/ai-visibility-checker.md 6章）。
 *
 * この段階ではAPIを呼ばず、値の出どころは lib/ai-check/mock.ts のモックデータ。
 * 型そのものは API 実装（フェーズ2）でそのまま使う想定で定義してある。
 */

/** 計測に使ったAI。β版はClaudeのみだが、将来ChatGPT/Geminiを足せるよう型にしてある */
export type Engine = "Claude";

/** 入力画面で受け取る3項目。エリア・ジャンルは任意（空なら既定値を使う） */
export type CheckInput = {
  storeName: string;
  area: string;
  genre: string;
};

/** AIに投げる質問1問 */
export type CheckQuestion = {
  index: number;
  text: string;
  engine: Engine;
};

/** 質問1問の結果 */
export type QuestionResult = {
  index: number;
  question: string;
  engine: Engine;
  /** error は「AIから回答を取得できなかった」。スコア集計から除外する */
  status: "done" | "error";
  mentioned: boolean;
  /** 回答リスト内の順位。順位が読み取れないときは null */
  position: number | null;
  /** 実際に一致した表記（レポートのハイライトに使う） */
  matchedText: string | null;
  /** 回答に登場した店名を登場順に。自店も含む */
  stores: string[];
  /** 回答の抜粋 */
  excerpt: string;
};

export type Rank = "S" | "A" | "B" | "C" | "D";

/**
 * 判定の色づかい。既存トークンに成功色（緑）も危険色（赤）も無いため、
 * 「アクセント色」と「グレー」の2値で表す（docs/plans/ai-visibility-checker.md 9-2）。
 */
export type RankTone = "accent" | "muted";

export type RankInfo = {
  rank: Rank;
  label: string;
  tone: RankTone;
};

/** 「AIが代わりに推薦しているお店」1件 */
export type Competitor = {
  name: string;
  count: number;
};

/** レポート画面が必要とするものすべて */
export type CheckReport = {
  store: string;
  area: string;
  genre: string;
  /** 診断日時（ISO8601） */
  checkedAt: string;
  score: number;
  rank: Rank;
  rankLabel: string;
  rankTone: RankTone;
  /** 登場した問数 */
  hitCount: number;
  /** スコア集計の母数（取得に成功した問数） */
  validCount: number;
  /** 取得に失敗した問数 */
  errorCount: number;
  questions: QuestionResult[];
  competitors: Competitor[];
  summary: string;
};
