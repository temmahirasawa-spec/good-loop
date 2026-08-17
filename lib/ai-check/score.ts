import type { QuestionResult, RankInfo } from "./types";

/**
 * AI視認性スコアと判定（docs/prototypes/ai-visibility-checker.html の calcScore / rankOf）。
 *
 * 配点の考え方:
 *   - 登場率で最大78点。「出たか出ないか」が主。
 *   - 順位ボーナスで最大22点。1位に近いほど加点し、6位以下は0点。
 * 合計を0〜100に丸める。
 *
 * 取得に失敗した問（status === "error"）は母数から除外する。
 * 通信の失敗を「登場しなかった」として減点すると、スコアが実態とずれるため。
 */

const HIT_WEIGHT = 78;
const POSITION_WEIGHT = 22;
/** 順位ボーナスが0になる順位。6位以下は加点なし */
const POSITION_FLOOR = 6;

export function validResults(results: QuestionResult[]): QuestionResult[] {
  return results.filter((r) => r.status !== "error");
}

export function calcScore(results: QuestionResult[]): number {
  const valid = validResults(results);
  const total = valid.length || 1;
  const hits = valid.filter((r) => r.mentioned);

  let score = (hits.length / total) * HIT_WEIGHT;
  for (const hit of hits) {
    // 順位が読み取れなかったときは POSITION_FLOOR 相当（＝ボーナス0）として扱う
    const position = hit.position ?? POSITION_FLOOR;
    const closeness = Math.max(0, POSITION_FLOOR - Math.min(position, POSITION_FLOOR));
    score += (closeness / (POSITION_FLOOR - 1)) * (POSITION_WEIGHT / total);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankOf(score: number): RankInfo {
  if (score >= 85) return { rank: "S", label: "AIの定番推薦になっています", tone: "accent" };
  if (score >= 70) return { rank: "A", label: "AIから十分見えています", tone: "accent" };
  if (score >= 50) return { rank: "B", label: "見えていますが、取りこぼしがあります", tone: "accent" };
  if (score >= 30) return { rank: "C", label: "AIからほとんど見えていません", tone: "muted" };
  return { rank: "D", label: "AIから見えていません", tone: "muted" };
}
