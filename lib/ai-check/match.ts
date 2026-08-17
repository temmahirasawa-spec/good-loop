import type { Competitor, QuestionResult } from "./types";

/**
 * 店名の表記ゆれ吸収と、競合店の集計
 * （docs/prototypes/ai-visibility-checker.html の norm / isTarget / competitors）。
 */

/** 空白・中黒・各種ハイフン・アポストロフィを落として小文字化する */
export function normalizeName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s　・･'’\-–—]/g, "");
}

/**
 * 回答に出てきた店名が自店かどうか。
 * 部分一致の双方向で見る（「YORKYS」と「YORKYS BRUNCH」を同じ店とみなすため）。
 */
export function isTargetStore(name: string, store: string, aliases: string[] = []): boolean {
  const target = normalizeName(store);
  const candidate = normalizeName(name);
  if (!candidate || !target) return false;
  if (candidate.includes(target) || target.includes(candidate)) return true;

  return aliases.some((alias) => {
    const normalized = normalizeName(alias);
    return normalized !== "" && (candidate.includes(normalized) || normalized.includes(candidate));
  });
}

/** JSON判定に失敗したときの保険。登場したかどうかだけを文字列一致で見る */
export function fallbackJudge(answer: string, store: string) {
  const hit = normalizeName(answer).includes(normalizeName(store));
  return {
    mentioned: hit,
    position: null,
    matchedText: hit ? store : null,
    stores: [] as string[],
  };
}

const COMPETITOR_LIMIT = 6;

/**
 * 全問の回答に登場した店名を数え、多い順に返す（自店は除く）。
 *
 * ⚠ 集計のキーは**正規化した名前**にすること。表示名のままだと
 *   「Honey Hunt Café」と「Honey Hunt café」が別の店として2行に出る
 *   （2026-08-17、実測で確認）。表示には最初に出てきた表記を使う。
 */
export function collectCompetitors(
  results: QuestionResult[],
  store: string,
  aliases: string[] = []
): Competitor[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const result of results) {
    for (const name of result.stores) {
      if (!name || isTargetStore(name, store, aliases)) continue;

      const key = normalizeName(name);
      if (key === "") continue;

      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { name, count: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, COMPETITOR_LIMIT);
}
