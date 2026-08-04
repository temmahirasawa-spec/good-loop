#!/usr/bin/env node
/**
 * テナントID検品
 *
 * GOOD LOOP は**マルチテナント**です。1つのデータベースに全クライアント（＝店舗）の
 * データが同居し、行単位で分離します。したがって、
 *
 *   「どの店舗のデータか」を示す列が無いテーブルは、作った瞬間に事故です。
 *   （全店舗のアンケート回答が混ざる／他店のデータが見える）
 *
 * これは人間が気をつけて防ぐものではなく、機械が落とすものにします。
 * supabase/ 配下の .sql を読み、CREATE TABLE ごとに次の2つを検査します。
 *
 *   1. テナント列（tenant_id）があること
 *   2. そのテーブルで RLS（行レベルセキュリティ）が有効化されていること
 *      ── 列があっても RLS が無ければ行は分離されないため、対で必須にしています
 *
 * 例外の書き方:
 *   CREATE TABLE の直前のコメント行に  -- tenant-check-allow: 理由  と書く。
 *   （全テナント共通のマスタ表など、店舗に属さないテーブル用。理由は必ず書く）
 *
 * 現時点でテーブルは0個なので、このチェックは何も見つけずに通ります。
 * 仕組みを先に置いておくことが目的です。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SQL_DIR = "supabase";
const TENANT_COLUMN = "tenant_id";
const ALLOW = "tenant-check-allow";

// ── 対象ファイルを集める ────────────────────────────────
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".sql")) files.push(p);
  }
}
const sqlRoot = join(ROOT, SQL_DIR);
if (existsSync(sqlRoot)) walk(sqlRoot);

if (files.length === 0) {
  console.log(`✔ テナントID検品: ${SQL_DIR}/ に .sql はまだありません（テーブル0個）`);
  process.exit(0);
}

/**
 * 括弧の対応を数えて CREATE TABLE の本体（列定義の丸括弧の中身）を取り出す。
 * 正規表現だけでは入れ子の括弧（numeric(10,2) など）で破綻するため、手で数える。
 */
function findTables(sql) {
  const out = [];
  const re = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-z0-9_."]+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const open = re.lastIndex - 1;
    let depth = 0, end = -1;
    for (let i = open; i < sql.length; i++) {
      if (sql[i] === "(") depth++;
      else if (sql[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) continue; // 閉じていない＝壊れたSQL。typecheck ではなく DB 側の問題なので触らない
    out.push({
      name: m[1].replace(/"/g, "").split(".").pop().toLowerCase(),
      qualified: m[1].replace(/"/g, ""),
      body: sql.slice(open + 1, end),
      index: m.index,
      line: sql.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

/** 本体をトップレベルのカンマで分割する（型引数の中のカンマでは切らない） */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

const CONSTRAINT_KEYWORDS = new Set([
  "constraint", "primary", "foreign", "unique", "check", "exclude", "like", "inherits",
]);

/** その定義部が「列定義」なら列名を返す。制約定義なら null */
function columnName(part) {
  const first = part.trim().split(/\s+/)[0];
  if (!first) return null;
  const bare = first.replace(/"/g, "").toLowerCase();
  if (CONSTRAINT_KEYWORDS.has(bare)) return null;
  return bare;
}

/** CREATE TABLE の直前のコメント行に除外指定があるか */
function isAllowed(sql, index) {
  const before = sql.slice(0, index).split("\n");
  for (let i = before.length - 1; i >= 0; i--) {
    const t = before[i].trim();
    if (t === "") continue;
    if (!t.startsWith("--")) return false;
    if (t.includes(ALLOW)) return true;
  }
  return false;
}

// ── 走査 ────────────────────────────────────────────────
const violations = [];
const allowedTables = [];
let tableCount = 0;

// RLS の有効化はファイルをまたいで書かれうるので、先に全文を集める
const sources = files.map((f) => ({ file: relative(ROOT, f), sql: readFileSync(f, "utf8") }));
const allSql = sources.map((s) => s.sql).join("\n");
const rlsEnabled = new Set();
for (const m of allSql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?([a-z0-9_."]+)\s+enable\s+row\s+level\s+security/gi)) {
  rlsEnabled.add(m[1].replace(/"/g, "").split(".").pop().toLowerCase());
}

for (const { file, sql } of sources) {
  for (const t of findTables(sql)) {
    tableCount++;
    if (isAllowed(sql, t.index)) { allowedTables.push(`${t.qualified}（${file}:${t.line}）`); continue; }

    const columns = splitTopLevel(t.body).map(columnName).filter(Boolean);
    if (!columns.includes(TENANT_COLUMN)) {
      violations.push({
        file, line: t.line, table: t.qualified,
        msg: `${TENANT_COLUMN} 列がありません。どの店舗のデータか分からないテーブルは作れません`,
      });
    }
    if (!rlsEnabled.has(t.name)) {
      violations.push({
        file, line: t.line, table: t.qualified,
        msg: `RLS が有効化されていません。alter table ${t.qualified} enable row level security; を書いてください`,
      });
    }
  }
}

// ── 報告 ────────────────────────────────────────────────
if (violations.length === 0) {
  console.log(`✔ テナントID検品: ${tableCount} テーブル（除外 ${allowedTables.length} 件）— 問題なし`);
  process.exit(0);
}

console.error("");
console.error("=".repeat(70));
console.error(" テナントID検品 — マルチテナントの分離が保証されていないテーブルがあります");
console.error("=".repeat(70));
console.error("");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.table}`);
  console.error(`    ・${v.msg}`);
}
console.error("");
console.error("─".repeat(70));
console.error(" GOOD LOOP は1つのDBに全クライアントのデータを入れ、行単位で分離します。");
console.error(` 店舗に属するテーブルには必ず ${TENANT_COLUMN} 列を置き、RLS を有効化してください。`);
console.error("");
console.error(" 全テナント共通のマスタ表など、店舗に属さないテーブルだけは、");
console.error(` CREATE TABLE の直前のコメント行に  -- ${ALLOW}: 理由  と書いて除外できます。`);
console.error(" 理由は必ず書いてください。");
console.error("=".repeat(70));
console.error("");

process.exit(1);
