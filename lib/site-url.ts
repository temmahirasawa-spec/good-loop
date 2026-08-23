/**
 * 来店客の入口URLのドメイン。
 *
 * **2026-08-24、サービス名が GOOD LOOP → GOOD REVIEW に確定したため差し替えた**
 * （旧 `app.goodloop.jp`。ドメインの都合で改名。天真決定）。
 * ドメイン自体はまだ取得前（launch-plan.md フェーズ6）だが、QRコードに印字する値は
 * 一度発行したら簡単には変えられないため、取得予定の本番ドメインを最初から使う。
 *
 * ⚠ **この値を変えると、既に印刷した卓上POPの二次元コードが開かなくなる。**
 */
export const PUBLIC_APP_URL = "https://app.good-review.jp";
