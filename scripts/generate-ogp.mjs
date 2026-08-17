#!/usr/bin/env node
/**
 * OGP画像の生成ツール
 *
 *   node scripts/generate-ogp.mjs
 *
 * 出力: public/ogp/*.png（1200x630）
 *
 * ── なぜ Playwright で作って public/ に置くのか ──────────────────
 * Next.js には `opengraph-image.tsx`（next/og の ImageResponse）で実行時に生成する
 * 仕組みがあるが、**日本語のフォントを自前で読み込ませる必要がある**。
 * フォントのバイナリをリポジトリに置くか実行時に取りに行くことになり、
 * どちらも重い。ここは内容がめったに変わらない静的な画像なので、
 * ヘッドレスChromium（システムの日本語フォントが使える）で焼いて置くほうが素直。
 * scripts/screenshot.mjs と同じ道具立てで、実行時のコストもゼロ。
 *
 * ── 色について ────────────────────────────────────────────────
 * **色は app/design-tokens.css と app/product-tokens.css から読む。**
 * ここに16進数を直書きすると、トークンを変えたときに画像だけ取り残される
 * （CLAUDE.md 4章「生の色コードを直接書かない」の趣旨）。
 */

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "public", "ogp");

/** CSSファイルから `--name: value;` を拾う */
function readTokens(...files) {
  const tokens = {};
  for (const file of files) {
    const css = readFileSync(join(ROOT, file), "utf8");
    for (const line of css.split("\n")) {
      const m = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/.exec(line);
      if (m && !(m[1] in tokens)) tokens[m[1]] = m[2].trim();
    }
  }
  return tokens;
}

/**
 * design-tokens.css は9業態ぶんの定義が並んでいる。
 * 先に出てくる Clinic ではなく、このページが使う `school` の値を取りたいので、
 * 該当セレクタのブロックだけを切り出して読む。
 */
function readThemeTokens(file, theme) {
  const css = readFileSync(join(ROOT, file), "utf8");
  const block = new RegExp(`\\[data-loop-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`テーマ ${theme} が ${file} に見つかりません`);

  const tokens = {};
  for (const line of block[1].split("\n")) {
    const m = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/.exec(line);
    if (m) tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const product = readTokens("app/product-tokens.css");
const loop = readThemeTokens("app/design-tokens.css", "school");

const t = {
  ink: product["--product-color-text-primary"],
  sub: product["--product-color-text-secondary"],
  surface: product["--product-color-surface-white"],
  ground: product["--product-color-bg-primary"],
  line: product["--product-color-border-default"],
  accent: loop["--loop-accent-primary"],
  accentLight: loop["--loop-accent-light"],
  accentDeep: loop["--loop-accent-action"],
  accentWash: loop["--loop-accent-wash"],
};

for (const [key, value] of Object.entries(t)) {
  if (!value) throw new Error(`トークン ${key} を読めませんでした`);
}

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; display: flex; flex-direction: column;
    justify-content: space-between; padding: 72px 80px;
    background: ${t.ground};
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif;
    color: ${t.ink};
  }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .wordmark { font-size: 30px; font-weight: 700; letter-spacing: .02em; }
  .wordmark .mk { background: linear-gradient(to top, ${t.accentLight} 40%, transparent 40%); padding: 0 4px; }
  .beta {
    font-size: 17px; font-weight: 600; letter-spacing: .12em;
    border: 1px solid ${t.line}; background: ${t.surface};
    border-radius: 999px; padding: 10px 22px; color: ${t.sub};
  }
  h1 { font-size: 74px; font-weight: 700; line-height: 1.3; letter-spacing: .01em; }
  h1 em { font-style: normal; background: linear-gradient(to top, ${t.accentLight} 34%, transparent 34%); padding: 0 6px; }
  .sub { font-size: 25px; color: ${t.sub}; margin-top: 26px; line-height: 1.7; }
  .bottom { display: flex; align-items: center; gap: 16px; }
  .chip {
    font-size: 19px; font-weight: 700; color: ${t.accentDeep};
    background: ${t.accentWash}; border: 1px solid ${t.accentLight};
    border-radius: 999px; padding: 10px 22px;
  }
  .by { font-size: 18px; color: ${t.sub}; margin-left: auto; letter-spacing: .06em; }
</style></head>
<body>
  <div class="top">
    <div class="wordmark">GOOD <span class="mk">REVIEW</span></div>
    <div class="beta">AI VISIBILITY CHECKER β</div>
  </div>

  <div>
    <h1>あなたのお店、<br><em>AIに聞くと</em>出てきますか？</h1>
    <p class="sub">実際にAIへ質問を投げて、あなたのお店が推薦されるかを無料でチェックします。</p>
  </div>

  <div class="bottom">
    <span class="chip">無料</span>
    <span class="chip">登録不要</span>
    <span class="chip">その場で結果</span>
    <span class="by">GOOD SERIES by UTUTU</span>
  </div>
</body></html>`;

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "load" });
  const out = join(OUT_DIR, "ai-check.png");
  await page.screenshot({ path: out });
  console.log(`✔ ${out}（1200x630 / accent=${t.accent}）`);
} finally {
  await browser.close();
}
