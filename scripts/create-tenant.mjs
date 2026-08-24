#!/usr/bin/env node
/**
 * 新しい契約先（テナント）を作るツール
 *
 *   node scripts/create-tenant.mjs --name "株式会社○○" --email "someone@example.com" \
 *     --store "○○店" --theme restaurant --quota 3
 *
 *   --dry-run を付けると、何をするかだけ表示して**書き込みません**（既定は dry-run）。
 *   実際に作るときは --commit を付けます。
 *
 * ── なぜこれが要るのか ──────────────────────────────────
 * GOOD REVIEW には新規登録の画面がありません（申し込みは商談経由のため）。
 * そのため契約が決まった時点で、運営側がこのツールで
 *
 *   1. tenants に1行（契約先。store_quota ＝ 契約店舗数）
 *   2. Supabase Auth にログイン用ユーザー1人（app_metadata.tenant_id を焼く）
 *   3. stores に最初の1店舗
 *
 * を作ります。**2 の app_metadata.tenant_id が RLS の全ての土台**で、
 * これが無いユーザーはログインできても自分のデータが1件も見えません
 * （supabase/0002_tenants_and_rls.sql）。画面からは設定できないため、ここで焼きます。
 *
 * ── 安全のための作り ────────────────────────────────────
 *   - 既定が dry-run。--commit を明示しない限り書き込まない
 *   - 途中で失敗したら、その手前までに作ったものを消して元に戻す（後始末）
 *   - 同じメールアドレスのユーザーが既にいたら、何もせず止まる
 *   - 招待メールは送らない。パスワードは発行してこの画面に出すので、
 *     **安全な経路（1Password 等）で本人に渡してください**
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const THEMES = [
  "clinic", "restaurant", "salon", "beauty", "seikotsuin",
  "fitness", "school", "pet", "lodging-sauna",
];

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

/** 店舗名から URL に使うスラッグを作る。日本語は使えないので、無ければ乱数にする */
function slugify(name) {
  const ascii = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `store-${randomBytes(3).toString("hex")}`;
}

/** 記号を混ぜた24文字。人が覚える必要はなく、初回ログイン後に変えてもらう前提 */
function generatePassword() {
  return randomBytes(18).toString("base64url").slice(0, 24);
}

const args = parseArgs(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const problems = [];
if (!url || !key) problems.push("環境変数 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が要ります（.env.local を読み込んでから実行してください）");
if (!args.name) problems.push("--name（契約先の名前）は必須です");
if (!args.email) problems.push("--email（ログインするメールアドレス）は必須です");
if (!args.store) problems.push("--store（最初の店舗名）は必須です");
if (args.theme && !THEMES.includes(args.theme)) problems.push(`--theme は次のどれかです: ${THEMES.join(", ")}`);
if (args.quota && !/^\d+$/.test(args.quota)) problems.push("--quota は数字です（契約店舗数）");

if (problems.length > 0) {
  console.error("\n設定が足りません。\n");
  for (const p of problems) console.error("  ・" + p);
  console.error("\n例:\n  node scripts/create-tenant.mjs --name '株式会社UTUTU' --email 'owner@example.com' \\\n    --store '三宮本店' --theme restaurant --quota 3 --commit\n");
  process.exit(1);
}

const theme = args.theme ?? "restaurant";
const quota = Number(args.quota ?? 1);
const slug = args.slug ?? slugify(args.store);
const password = generatePassword();

const supabase = createClient(url, key, { auth: { persistSession: false } });

/*
 * dry-run の時点で衝突を知らせる。スラッグはDBで一意なので、
 * --commit してから落ちると後始末が走るだけ無駄になる。先に気づけるようにする。
 */
const warnings = [];
{
  const { data: sameSlug } = await supabase.from("stores").select("id, name").eq("slug", slug).maybeSingle();
  if (sameSlug) warnings.push(`スラッグ "${slug}" は既に「${sameSlug.name}」が使っています。--slug で別の名前を指定してください`);

  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) warnings.push(`既存ユーザーを確認できませんでした（${error.message}）`);
  else if (users.users.some((u) => u.email?.toLowerCase() === args.email.toLowerCase())) {
    warnings.push(`${args.email} はすでに登録されています`);
  }
}

console.log("\nこれから作るもの");
console.log("  契約先        :", args.name);
console.log("  店舗枠        :", quota, "店舗");
console.log("  ログイン       :", args.email);
console.log("  最初の店舗     :", args.store, `(テーマ: ${theme})`);
console.log("  お客様のURL    :", `https://app.good-review.jp/r/${slug}`);

if (warnings.length > 0) {
  console.log("\n⚠ このままでは作成できません");
  for (const w of warnings) console.log("  ・" + w);
  console.log("");
  process.exit(1);
}

if (!args.commit) {
  console.log("\n[dry-run] 何も書き込んでいません。実際に作るには --commit を付けてください。\n");
  process.exit(0);
}

/** 失敗したときに戻すための後始末リスト（新しいものから順に実行する） */
const undo = [];
async function rollback() {
  for (const step of undo.reverse()) {
    try { await step(); } catch (e) { console.error("  後始末に失敗:", e.message); }
  }
}

try {
  // 1) 契約先
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ name: args.name, store_quota: quota })
    .select("id")
    .single();
  if (tenantError) throw new Error(`契約先の作成に失敗: ${tenantError.message}`);
  undo.push(() => supabase.from("tenants").delete().eq("id", tenant.id));
  console.log("\n✔ 契約先を作成:", tenant.id);

  // 2) ログイン用ユーザー。**app_metadata.tenant_id がRLSの土台**
  const { data: created, error: userError } = await supabase.auth.admin.createUser({
    email: args.email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenant.id },
  });
  if (userError) throw new Error(`ログイン用ユーザーの作成に失敗: ${userError.message}`);
  undo.push(() => supabase.auth.admin.deleteUser(created.user.id));
  console.log("✔ ログイン用ユーザーを作成:", created.user.id);

  // 3) 最初の店舗
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .insert({ tenant_id: tenant.id, name: args.store, slug, loop_theme: theme, business_category: theme })
    .select("id, slug")
    .single();
  if (storeError) throw new Error(`店舗の作成に失敗: ${storeError.message}`);
  console.log("✔ 最初の店舗を作成:", store.id);

  console.log("\n─────────────────────────────────────────");
  console.log(" 本人に渡す情報（安全な経路で）");
  console.log("─────────────────────────────────────────");
  console.log("  管理画面 : https://app.good-review.jp/admin/login");
  console.log("  メール   :", args.email);
  console.log("  パスワード:", password);
  console.log("─────────────────────────────────────────");
  console.log(" ⚠ このパスワードは再表示できません。いま控えてください。");
  console.log("   初回ログイン後に本人が変更する前提です。\n");
} catch (e) {
  console.error("\n✗", e.message);
  console.error("  途中まで作ったものを取り消します…");
  await rollback();
  console.error("  取り消しました。\n");
  process.exit(1);
}
