import { validResults } from "./score";
import type { QuestionResult } from "./types";

/**
 * 総評の文面（docs/prototypes/ai-visibility-checker.html の autoSummary）。
 *
 * **AIには書かせない。** 診断結果から機械的に組み立てるテンプレート。
 * ここでAIに文章を書かせると、実測していないことまで書いてしまう恐れがあるため。
 */
export function buildSummary(results: QuestionResult[], store: string): string {
  const valid = validResults(results);
  const total = valid.length;
  const hits = valid.filter((r) => r.mentioned).length;

  if (total === 0) {
    return "今回はAIから回答を取得できませんでした。時間をおいてもう一度お試しください。";
  }

  if (hits === 0) {
    return (
      `今回の${total}問で「${store}」は一度も登場しませんでした。` +
      "AIが参照できる情報 — 直近の口コミ、オーナー返信、構造化された店舗情報、第三者メディアの言及 — を増やすことが、登場への最短ルートです。" +
      "詳細な要因分析はフルレポートでお送りします。"
    );
  }

  if (hits === total) {
    return (
      `全${total}問で登場しました。` +
      "この状態を維持するには、口コミの鮮度とオーナー返信の継続が重要です。定点観測でスコアの推移を追いましょう。"
    );
  }

  return (
    `${total}問中${hits}問で登場しました。` +
    "登場しなかった質問の文脈（周辺キーワード）に対する情報が不足している可能性があります。" +
    "詳細な要因分析はフルレポートでお送りします。"
  );
}
