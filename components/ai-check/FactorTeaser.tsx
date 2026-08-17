/**
 * 要因分析（03 · Why）の頭出し。
 *
 * ⚠⚠ **点数やグラフを出さないこと。** ⚠⚠
 *   ここに「口コミ件数 34点」のような店舗別に見える数字を固定で置くと、
 *   オーナーは**自分の店の実測値**だと受け取る。GOOD REVIEW はこれらを測っていないので、
 *   それは診断ではなく作り話になる（docs/plans/ai-visibility-checker.md 1-3 / 9-1）。
 *
 *   出してよいのは「フルレポートで何を見るか」という**項目そのもの**まで。
 *   実際に測れるようになったら、そのときに数値を入れる。
 *
 * 項目は docs/prototypes/ai-visibility-checker.html の DEMO.factors に揃えてある。
 */

const FACTORS = [
  {
    name: "直近90日の新規口コミ",
    body: "投稿のペースが落ちていないか。AIは新しい情報を優先します。",
  },
  {
    name: "口コミへのオーナー返信率",
    body: "返信はAIが拾う信頼のシグナルです。",
  },
  {
    name: "基本情報の鮮度（営業時間・メニュー）",
    body: "古い情報が残っていると、AIの回答も古い内容になります。",
  },
  {
    name: "写真の量と質",
    body: "掲載枚数と、料理・内観・外観のバランスを見ます。",
  },
  {
    name: "公式サイトの構造化データ",
    body: "メニューや営業情報が機械可読になっているか。",
  },
  {
    name: "第三者メディア・ブログでの言及",
    body: "どの文脈で語られているかに偏りがないか。",
  },
];

export function FactorTeaser() {
  return (
    <div>
      <p
        className="mb-[var(--product-space-12)] text-[13.5px] leading-[1.9]"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
        AIがあなたのお店をどこから知るのか、その入り口を6つの観点で調べます。
      </p>

      <ul className="m-0 list-none p-0">
        {FACTORS.map((factor) => (
          <li
            key={factor.name}
            className="border-b border-solid py-[var(--product-space-12)] last:border-b-0"
            style={{ borderColor: "var(--product-color-border-divider)" }}
          >
            <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {factor.name}
            </p>
            <p
              className="mt-[var(--product-space-2)] text-[12.5px] leading-[1.7]"
              style={{ color: "var(--product-color-text-secondary)" }}
            >
              {factor.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
