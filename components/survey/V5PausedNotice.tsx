import { CheckCircleIcon } from "@/components/demo/icons";

/**
 * 停止中のお知らせ（v5 の見た目・案B「お知らせの紙」。2026-09-28 天真が選択）。
 * Figma `02 基本形` の「来店客 / 停止中のお知らせ — SP 390」。3案は MTG ページの `13 停止中のお知らせ`。
 *
 * 出すのは docs/specs/billing.md §3-8（旧 5-2 の案C「店のせいに見せない」）の文言だけ。
 * **停止の理由も、GOOD REVIEW の名前も出さない。** 卓上POPを読んだお客様には何の落ち度もなく、
 * 「この店が何かしくじっている」と映ると傷がつくのは店舗の信用だから。
 *
 * 本番の `/r/[storeSlug]` では、`lib/billing/survey-gate.ts` の `isSurveyStopped`（カード登録前・お休み中）で出す（2026-10-03）。
 *   見た目と動きは components/survey/v5.css（`.v5` の下だけに効く）。
 */
export function V5PausedNotice() {
  return (
    <main className="v5 mx-auto flex min-h-dvh w-full max-w-[390px] flex-col items-center justify-center px-[var(--product-space-20)] py-[var(--product-space-40)]">
      <div
        className="v5-land v5-paper-card flex w-full flex-col items-center gap-[var(--product-space-20)] rounded-[20px] border-2 border-solid px-[var(--product-space-24)] py-[var(--product-space-40)] text-center"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--v5-ink)" }}
      >
        <CheckCircleIcon className="size-16 shrink-0" style={{ color: "var(--product-color-text-tertiary)" }} />
        <h1 className="text-xl font-bold leading-[1.5]">
          このアンケートは
          <br />
          現在お休みしています
        </h1>
        <p className="text-sm leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
          ご協力ありがとうございました
        </p>
      </div>
    </main>
  );
}
