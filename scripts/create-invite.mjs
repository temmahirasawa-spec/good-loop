#!/usr/bin/env node
/**
 * 招待コードを発行するツール（試験導入＝招待制ベータ。supabase/0018、2026-10-01）
 *
 *   npm run invite:create -- --label "○○カフェ 山田さん" --uses 1 --days 30
 *
 *   --label  誰に渡すかのメモ（必須）。台帳（invite_codes.label）に残る
 *   --uses   何回まで使えるか（既定 1 ＝ 1つの契約先だけ）
 *   --days   何日間使えるか（既定 30）
 *
 *   --dry-run を付けると、何をするかだけ表示して**書き込みません**（既定は dry-run）。
 *   実際に作るときは --commit を付けます（scripts/create-tenant.mjs と同じ）。
 *
 * ── 何をするのか ────────────────────────────────────────
 * invite_codes に1行足し、本人に渡す「招待コード」と「登録用のURL」を表示します。
 * URL を開くと、コードが入った状態で新規登録の画面（/signup）が開きます。
 * このコードで登録した契約先は「試験導入中（無料）」になります（tenants.is_pilot = true）。
 * 管理画面にトライアルの残り日数・お支払いの案内が出ません。
 *
 * ── コードの形 ──────────────────────────────────────────
 * 「XXXX-XXXX」。紛らわしい 0 O 1 I L を使わない31文字から、暗号用の乱数で選びます。
 * 31の8乗 ≒ 8,500億通り。登録の回数制限（1つの回線で1時間3回）とあわせて、
 * 当てずっぽうで当たることはありません。
 *
 * ── 渡したコードを止めたいとき ─────────────────────────────
 * 行は消さずに disabled_at を埋めてください（Supabase の SQL Editor で）。
 *   update invite_codes set disabled_at = now() where code = 'XXXX-XXXX';
 */

import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";

/**
 * コードに使う文字。紛らわしい 0 O 1 I L を除いた31文字。
 * 入力の揺れのそろえ方は lib/signup/invite-code.ts（DB には XXXX-XXXX の形で入る）。
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SIGNUP_URL = "https://app.good-review.jp/signup";
const MAX_USES = 100;
const MAX_DAYS = 365;

function parseArgs(argv) {
  const out = { commit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--commit") out.commit = true;
    else if (a === "--dry-run") out.commit = false;
    else if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
  }
  return out;
}

/** 1〜max の整数か。値が無ければ既定値を返す。だめなら null */
function intInRange(value, fallback, max) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= max ? n : null;
}

/** XXXX-XXXX を作る。randomInt は暗号用の乱数で、文字の出方に偏りが出ない */
function generateCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** 「2026年10月31日 21:47」の形（日本時間） */
function formatJst(date) {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const args = parseArgs(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const label = typeof args.label === "string" ? args.label.trim() : "";
const uses = intInRange(args.uses, 1, MAX_USES);
const days = intInRange(args.days, 30, MAX_DAYS);

const problems = [];
if (!url || !key) problems.push("環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が要ります（.env.local を読み込んでから実行してください）");
if (!label) problems.push("--label（誰に渡すかのメモ）は必須です");
if (uses === null) problems.push(`--uses は 1〜${MAX_USES} の数字です（何回まで使えるか）`);
if (days === null) problems.push(`--days は 1〜${MAX_DAYS} の数字です（何日間使えるか）`);

if (problems.length > 0) {
  console.error("\n設定が足りません。\n");
  for (const p of problems) console.error("  ・" + p);
  console.error("\n例:\n  npm run invite:create -- --label '○○カフェ 山田さん' --uses 1 --days 30 --commit\n");
  process.exit(1);
}

const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const supabase = createClient(url, key, { auth: { persistSession: false } });

/*
 * dry-run の時点で、台帳の表があるかを確かめる。
 * supabase/0018 を実行する前だと、--commit してから落ちることになるため、先に気づけるようにする。
 */
{
  const { error } = await supabase.from("invite_codes").select("id", { count: "exact", head: true });
  if (error) {
    console.error("\n⚠ 招待コードの台帳（invite_codes）を読めませんでした。");
    console.error("  supabase/0018_invite_codes.sql を Supabase で実行済みか確認してください。");
    console.error(`  （${error.message}）\n`);
    process.exit(1);
  }
}

console.log("\nこれから作るもの");
console.log("  渡す相手（メモ）:", label);
console.log("  使える回数      :", uses, "回");
console.log("  期限            :", formatJst(expiresAt), "まで（日本時間）");

if (!args.commit) {
  console.log("\n[dry-run] 何も書き込んでいません。実際に作るには --commit を付けてください。");
  console.log("          コードは --commit で作るときに決まります。\n");
  process.exit(0);
}

let created = null;
for (let attempt = 1; attempt <= 5; attempt++) {
  const code = generateCode();
  const { data, error } = await supabase
    .from("invite_codes")
    .insert({ code, label, max_uses: uses, expires_at: expiresAt.toISOString() })
    .select("id, code")
    .single();
  if (!error) {
    created = data;
    break;
  }
  // 23505 = 同じコードがすでにある（約8,500億分の1）。別のコードで作り直す
  if (error.code === "23505") continue;
  console.error("\n✗ 招待コードの作成に失敗:", error.message, "\n");
  process.exit(1);
}

if (!created) {
  console.error("\n✗ 招待コードを作れませんでした（同じコードが続けて重なった）。もう一度実行してください。\n");
  process.exit(1);
}

const signupUrl = `${SIGNUP_URL}?code=${created.code}`;

console.log("\n─────────────────────────────────────────");
console.log(" 本人に渡す情報");
console.log("─────────────────────────────────────────");
console.log("  招待コード :", created.code);
console.log("  登録用URL  :", signupUrl);
console.log("  使える回数 :", uses, "回");
console.log("  期限       :", formatJst(expiresAt), "まで（日本時間）");
console.log("─────────────────────────────────────────");
console.log(" URL を開くと、コードが入った状態で登録の画面が開きます。");
console.log(" このコードで登録したお店は「試験導入中（無料）」になります。\n");
