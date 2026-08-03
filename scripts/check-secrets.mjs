#!/usr/bin/env node
/**
 * 秘密情報の混入検出
 *
 * **このリポジトリは public です。** Supabase のサービスキーや Figma のトークンが
 * 1コミットでも入ったら、その時点で漏洩です。GitHub から消しても履歴に残るため、
 * 「入ってから気づく」では手遅れになります。入る前に落とします。
 *
 * 対象: Git が追跡しているファイル ＋ .gitignore で除外されていない未追跡ファイル
 *       （＝ `git add .` したら入ってしまうもの全部）
 *
 * 検出するもの:
 *   ・Supabase のサービスキー / アクセストークン / JWT
 *   ・Figma / Anthropic / GitHub / AWS / Sentry / Slack のトークン・Webhook
 *   ・秘密鍵ファイルの中身
 *   ・実値が入った .env ファイルがコミット対象になっていること
 *   ・SECRET / PASSWORD 等の名前の変数に、プレースホルダでない値が代入されていること
 *
 * 例外の書き方:
 *   その行、または直前の行に  secret-scan-allow: 理由  と書く。
 *   （テスト用のダミー値など。実物の値には絶対に使わないこと）
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.cwd();
const ALLOW = "secret-scan-allow";
const MAX_BYTES = 2 * 1024 * 1024;

/** 中身がテキストでないファイル。読んでも意味がない */
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|mov|webm|mp3|wav|pdf|zip|gz|tgz|node|wasm)$/i;

/**
 * 値がプレースホルダなら秘密ではない。
 * .env.local.example のような「形だけ書いたファイル」を落とさないため。
 */
const PLACEHOLDER = /(placeholder|your[-_]|example|sample|dummy|changeme|xxxx|\.\.\.|<[^>]*>|\$\{|process\.env)/i;

const RULES = [
  { id: "private-key",   re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,            what: "秘密鍵の中身" },
  { id: "jwt",           re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, what: "JWT（Supabase の anon / service_role キーはこの形）" },
  { id: "supabase-secret", re: /\bsb_secret_[A-Za-z0-9_-]{16,}/,              what: "Supabase のシークレットキー" },
  { id: "supabase-pat",  re: /\bsbp_[a-f0-9]{40}\b/,                          what: "Supabase のアクセストークン" },
  { id: "figma-pat",     re: /\bfigd_[A-Za-z0-9_-]{20,}/,                     what: "Figma のパーソナルアクセストークン" },
  { id: "anthropic",     re: /\bsk-ant-[A-Za-z0-9_-]{20,}/,                   what: "Anthropic APIキー" },
  { id: "openai",        re: /\bsk-proj-[A-Za-z0-9_-]{20,}/,                  what: "OpenAI APIキー" },
  { id: "github-token",  re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/,                 what: "GitHub のトークン" },
  { id: "github-pat",    re: /\bgithub_pat_[A-Za-z0-9_]{40,}/,                what: "GitHub のパーソナルアクセストークン" },
  { id: "aws",           re: /\bAKIA[0-9A-Z]{16}\b/,                          what: "AWS のアクセスキーID" },
  { id: "sentry-token",  re: /\bsntry[su]_[A-Za-z0-9_-]{30,}/,                what: "Sentry のトークン" },
  { id: "slack-webhook", re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/+]{20,}/, what: "Slack の Incoming Webhook URL" },
  { id: "npm-token",     re: /_authToken\s*=\s*\S+/,                          what: "npm レジストリの認証トークン" },
];

/** SECRET / PASSWORD 等の名前の変数に、実値らしきものが代入されている */
const ASSIGNMENT =
  /\b([A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|API_KEY)[A-Z0-9_]*)\s*[:=]\s*["'`]?([^\s"'`,;]{12,})/g;

// ── 対象ファイルを集める ────────────────────────────────
let files = [];
try {
  files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean);
} catch {
  console.error("✗ 秘密情報検出: git のファイル一覧を取得できませんでした（Gitリポジトリ内で実行してください）");
  process.exit(1);
}

const findings = [];

// ── 1. 実値が入りうる .env ファイルがコミット対象になっていないか ──
for (const f of files) {
  const base = basename(f);
  if (/^\.env/.test(base) && !/\.example$/.test(base)) {
    findings.push({ file: f, line: 1, what: ".env ファイルがコミット対象に入っています", snippet: base });
  }
}

// ── 2. 中身を走査する ────────────────────────────────────
const isAllowed = (lines, i) =>
  lines[i].includes(ALLOW) || (i > 0 && lines[i - 1].includes(ALLOW));

for (const f of files) {
  if (BINARY.test(f)) continue;
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  let st;
  try { st = statSync(p); } catch { continue; }
  if (!st.isFile() || st.size > MAX_BYTES) continue;

  const lines = readFileSync(p, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (isAllowed(lines, i)) return;

    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (m) findings.push({ file: f, line: i + 1, what: rule.what, snippet: mask(m[0]) });
    }

    ASSIGNMENT.lastIndex = 0;
    let a;
    while ((a = ASSIGNMENT.exec(line)) !== null) {
      if (PLACEHOLDER.test(a[2])) continue;
      findings.push({ file: f, line: i + 1, what: `${a[1]} に実値らしき文字列が書かれています`, snippet: mask(a[2]) });
    }
  });
}

/** 見つけたものをそのまま端末に出すと、そこでもう1回漏れる。頭だけ見せる */
function mask(s) {
  return s.length <= 8 ? "*".repeat(s.length) : `${s.slice(0, 6)}…${"*".repeat(8)}（${s.length}文字）`;
}

// ── 報告 ────────────────────────────────────────────────
if (findings.length === 0) {
  console.log(`✔ 秘密情報検出: ${files.length} ファイル — 混入なし`);
  process.exit(0);
}

console.error("");
console.error("=".repeat(70));
console.error(" 秘密情報検出 — コミットしてはいけないものが含まれています");
console.error("=".repeat(70));
console.error("");
for (const v of findings) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ・${v.what}  ${v.snippet}`);
}
console.error("");
console.error("─".repeat(70));
console.error(" このリポジトリは public です。1度でも push したら、履歴から消しても");
console.error(" 漏洩したものとして扱う必要があります（キーの再発行が必要になります）。");
console.error("");
console.error(" 対処:");
console.error("   1. 値を .env.local に移す（.gitignore で除外済み）");
console.error("   2. コードからは process.env 経由で読む");
console.error("   3. 例に書きたいだけなら .env.local.example にプレースホルダで書く");
console.error("");
console.error(` テスト用のダミー値など、本当に秘密でない場合だけ、その行か直前の行に`);
console.error(`   ${ALLOW}: 理由`);
console.error(" と書いて除外できます。実物の値には絶対に使わないこと。");
console.error("=".repeat(70));
console.error("");

process.exit(1);
