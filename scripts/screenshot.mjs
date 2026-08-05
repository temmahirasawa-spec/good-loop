#!/usr/bin/env node
/**
 * 画面確認用のスクリーンショット撮影ツール
 *
 * CLAUDE.md 2章「画面に見える変更を加えた場合は、PC幅1400px とスマホ幅390pxの2枚を撮る」を、
 * 天真の実ブラウザに触れずに満たすための仕組み。Playwright のヘッドレスChromiumで撮影する
 * （2026-08-05、claude-in-chrome で天真の実ブラウザを操作し続けたことへの反省から導入）。
 *
 * 前提: devサーバーが起動していること（このスクリプトはdevサーバーを起動しない。
 * AIはdevサーバーを勝手にバックグラウンド起動しない、というCLAUDE.mdの規約に合わせている）。
 *
 * 使い方:
 *   node scripts/screenshot.mjs <path> [baseUrl]
 *   例: node scripts/screenshot.mjs /r/demo-store
 *       node scripts/screenshot.mjs /r/demo-store http://localhost:3000
 *
 * 出力: .screenshots/<path正規化>-pc.png / -sp.png （.gitignore 済み。成果物ではなく確認用）
 *
 * 対話操作（タップして次の状態を見る等）が要る場合は、このスクリプトを直接編集するか、
 * `chromium.launch()` 以降を参考に一時スクリプトを書くこと。
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [, , targetPath, baseUrlArg] = process.argv;

if (!targetPath) {
  console.error("使い方: node scripts/screenshot.mjs <path> [baseUrl]");
  console.error("例:     node scripts/screenshot.mjs /r/demo-store");
  process.exit(1);
}

const baseUrl = baseUrlArg || "http://localhost:3000";
const url = new URL(targetPath, baseUrl).toString();
const outDir = ".screenshots";
mkdirSync(outDir, { recursive: true });
const slug = targetPath.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "root";

const VIEWPORTS = [
  { name: "pc", width: 1400, height: 900 },
  { name: "sp", width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response || !response.ok()) {
      console.error(`⚠ ${url} が ${response ? response.status() : "接続失敗"} を返した（${vp.name}）`);
    }
    const outPath = `${outDir}/${slug}-${vp.name}.png`;
    await page.screenshot({ path: outPath });
    const measured = await page.evaluate(() => ({ innerWidth: window.innerWidth, innerHeight: window.innerHeight }));
    console.log(`✔ ${vp.name}（${measured.innerWidth}x${measured.innerHeight} 実測） → ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
