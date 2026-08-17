import { collectCompetitors } from "./match";
import { normalizeInput } from "./questions";
import { calcScore, rankOf, validResults } from "./score";
import { buildSummary } from "./summary";
import type { CheckInput, CheckReport, QuestionResult } from "./types";

/**
 * 計測結果からレポートを組み立てる。
 *
 * サーバーにもクライアントにも依存しない純粋な関数。
 * 取得に失敗した問（status === "error"）はスコアの母数から外し、
 * 「何問落ちたか」を errorCount で画面に伝える（docs/plans/ai-visibility-checker.md 6-3）。
 */
export function buildReport(
  input: CheckInput,
  results: QuestionResult[],
  checkedAt: string
): CheckReport {
  const normalized = normalizeInput(input);
  const valid = validResults(results);
  const score = calcScore(results);
  const { rank, label, tone } = rankOf(score);

  return {
    store: normalized.storeName,
    area: normalized.area,
    genre: normalized.genre,
    checkedAt,
    score,
    rank,
    rankLabel: label,
    rankTone: tone,
    hitCount: valid.filter((result) => result.mentioned).length,
    validCount: valid.length,
    errorCount: results.length - valid.length,
    questions: results,
    competitors: collectCompetitors(valid, normalized.storeName),
    summary: buildSummary(results, normalized.storeName),
  };
}
