/**
 * フッターの但し書き。
 *
 * ⚠ **この文言は削らないこと。** レイアウトの都合で削らない（2026-08-17 天真の指示）。
 *   必要なのは次の3点。景品表示法まわりの配慮として要る
 *   （docs/plans/ai-visibility-checker.md 9-10）。
 *     1. 特定のAIサービスへの掲載や順位を保証するものではないこと
 *     2. 結果は計測時点のスナップショットで、日時・文脈・モデル更新で変動すること
 *     3. 他店の名前がどこから来たものかを明示すること
 *
 * ⚠ 3点目は 2026-08-17 に**文面を訂正した**。
 *   モックで作っていた頃は「レポート内の店舗名は対象店を除きすべて架空」と書いていたが、
 *   実測モードでは**AIの回答に実際に出てきた実在の店舗名**が並ぶ。事実と違う但し書きは、
 *   但し書きが無いより悪い。
 */
export function AiCheckFooter() {
  return (
    <footer className="w-full pb-[var(--product-space-48)] pt-[var(--product-space-24)]">
      <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-default)" }} />

      <p
        className="mt-[var(--product-space-16)] max-w-[44em] text-[11.5px] leading-[1.9]"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
        本ツールは、実際にAIアシスタントへ質問した応答を記録・解析して判定します。AIの回答は日時・文脈・モデルの更新によって変動するため、結果は計測時点のスナップショットです。特定のAIサービスへの掲載や順位を保証するものではありません。レポートに並ぶ他店の名前は、AIがその質問に対して実際に挙げたものであり、当社が選定・推薦したものではありません。
      </p>

      <p
        className="mt-[var(--product-space-12)] text-[11px] uppercase tracking-[1.54px]"
        style={{
          fontFamily: "var(--font-barlow), sans-serif",
          fontWeight: 600,
          color: "var(--product-color-text-secondary)",
        }}
      >
        GOOD REVIEW — GOOD SERIES by UTUTU
      </p>
    </footer>
  );
}
