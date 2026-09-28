/**
 * 来店客のアンケートの「お休み」のお知らせ（docs/specs/billing.md §3-2・§3-8）。
 *
 * 出すのは決めてある文言だけ（「このアンケートは現在お休みしています／ご協力ありがとうございました」）。
 * **停止の理由も、GOOD REVIEW の名前も出さない。** 卓上POPを読んだお客様には何の落ち度もなく、
 * 「この店が何かしくじっている」と映ると傷がつくのは店舗の信用だから。
 *
 * 形は Figma `02 基本形` の「来店客 / 停止中のお知らせ — SP 390」（案B お知らせの紙。2026-09-28 天真が選択）。
 * ⚠ 紙の色（生成り）と、ずらした影の色は、まだ Figma の変数・app/design-tokens.css に無い（v5 の試作だけの色）。
 *   ここでは今の本番のアンケートと同じ変数の色で出している。v5 を本番に入れるときに、変数を足して揃える。
 */
export function SurveyPausedNotice() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col items-center justify-center px-[var(--product-space-20)] py-[var(--product-space-40)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <div
        className="flex w-full flex-col items-center gap-[var(--product-space-20)] rounded-[20px] border-2 border-solid px-[var(--product-space-24)] py-[var(--product-space-40)] text-center"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--product-color-text-primary)" }}
      >
        <svg
          className="size-16 shrink-0"
          style={{ color: "var(--product-color-text-tertiary)" }}
          viewBox="0 0 64 64"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <path d="M32 60C47.464 60 60 47.464 60 32C60 16.536 47.464 4 32 4C16.536 4 4 16.536 4 32C4 47.464 16.536 60 32 60Z" strokeWidth={4.8} />
          <path d="M18.6667 32.8L28 42.1333L45.3333 24" strokeWidth={5.86667} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="text-xl font-bold leading-[1.5]" style={{ color: "var(--product-color-text-primary)" }}>
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
