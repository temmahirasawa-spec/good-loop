/**
 * 「要因分析」の枠に出す案内（docs/prototypes/ai-visibility-checker.html の factHtml の else 側）。
 *
 * ⚠ プロトタイプの要因分析（口コミ件数34点、オーナー返信率18点…）は
 *   **サンプル用の架空データ**で、実測モードでは表示されない。
 *   オーナー返信率などは Google の API では取得できないため、β版では数値を出さない
 *   （docs/plans/ai-visibility-checker.md 1-3 / 9-1、2026-08-17 天真了承）。
 */
export function FullReportNotice() {
  return (
    <p className="text-[13.5px] leading-[2]" style={{ color: "var(--product-color-text-secondary)" }}>
      口コミ件数・オーナー返信率・情報の鮮度・構造化データなどの
      <b className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        要因分析
      </b>
      は、フルレポート（無料）でお送りします。下のフォームからお申し込みください。
    </p>
  );
}
