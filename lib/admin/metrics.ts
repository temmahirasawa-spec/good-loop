import type { StoreSummary } from "./types";

/** 送客率（％）。回答数が0のときは算出しない */
export function routeRate(routeCount: number, responseCount: number): number | null {
  if (responseCount === 0) return null;
  return Math.round((routeCount / responseCount) * 100);
}

export function totals(stores: StoreSummary[]) {
  const sum = (pick: (s: StoreSummary) => number) => stores.reduce((acc, s) => acc + pick(s), 0);
  const routeCount = sum((s) => s.routeCount);
  const routeCountPrev = sum((s) => s.routeCountPrev);
  const responseCount = sum((s) => s.responseCount);
  const responseCountPrev = sum((s) => s.responseCountPrev);
  return {
    routeCount,
    routeCountPrev,
    responseCount,
    responseCountPrev,
    routeRatePercent: routeRate(routeCount, responseCount),
    routeRatePercentPrev: routeRate(routeCountPrev, responseCountPrev),
  };
}

/** 全店の送客数の推移（直近5週）。各週は stores の同じ週の合計 */
export function sumTrend(stores: StoreSummary[]): number[] {
  if (stores.length === 0) return [0, 0, 0, 0, 0];
  return stores[0].trend.map((_, i) => stores.reduce((acc, s) => acc + s.trend[i], 0));
}
