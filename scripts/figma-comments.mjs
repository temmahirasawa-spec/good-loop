#!/usr/bin/env node
/**
 * Figma のコメントを読む・返信する
 *
 *   npm run design:comments                     未解決のコメントを一覧する
 *   npm run design:comments -- --all            解決済みも含めて一覧する
 *   npm run design:comments -- --reply <id> "本文"   そのスレッドに返信する
 *
 * 何のためにあるか（2026-08-22、天真の依頼）:
 *   天真がFigmaの画面にコメントを刺し、AIがそれを読んで直す、という進め方をしたい。
 *   Figma の Plugin API（`use_figma`）はドキュメントの中身しか触れず、**コメントは読めない**。
 *   コメントは REST API にしか無いので、このスクリプトで取りに行く。
 *
 * ⚠ 必要なスコープ:
 *   `file_comments:read`（読む）と `file_comments:write`（返信する）。
 *   検品（scripts/check-figma.mjs）が使っている `file_content:read` だけでは 403 になる。
 *   トークンを発行し直したら ~/.zshrc の FIGMA_TOKEN を更新すること
 *   （GitHub のシークレットも忘れずに。CLAUDE.md 4章）。
 *
 * 出力は「どのフレームに」「誰が」「何を」書いたかを、コメントIDつきで並べる。
 * コメントIDは返信のときに使う。
 */

const FILE_KEY = "i7z9wGL6BpFoC2kwlGA1lV";
const TOKEN = process.env.FIGMA_TOKEN;

if (!TOKEN) {
  console.error("FIGMA_TOKEN が設定されていません。");
  console.error('~/.zshrc に  export FIGMA_TOKEN="figd_..."  を追加して、ターミナルを開き直してください。');
  process.exit(1);
}

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const replyIndex = args.indexOf("--reply");

async function api(path, init) {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    ...init,
    headers: { "X-Figma-Token": TOKEN, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403) {
      console.error("✗ 403（権限不足）。トークンに file_comments:read / file_comments:write が要ります。");
      console.error(`  Figmaの返答: ${text.slice(0, 200)}`);
      process.exit(1);
    }
    console.error(`✗ ${res.status} ${text.slice(0, 300)}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

// ── 返信する ─────────────────────────────────────────
if (replyIndex !== -1) {
  const commentId = args[replyIndex + 1];
  const message = args[replyIndex + 2];
  if (!commentId || !message) {
    console.error('使い方: npm run design:comments -- --reply <コメントID> "本文"');
    process.exit(1);
  }
  await api(`/files/${FILE_KEY}/comments`, {
    method: "POST",
    body: JSON.stringify({ message, comment_id: commentId }),
  });
  console.log(`✔ ${commentId} に返信しました`);
  process.exit(0);
}

// ── 一覧する ─────────────────────────────────────────
const [{ comments }, file] = await Promise.all([
  api(`/files/${FILE_KEY}/comments`),
  api(`/files/${FILE_KEY}?depth=3`),
]);

/** ノードIDから「ページ / セクション / フレーム」の名前を引けるようにする */
const nameById = new Map();
(function walk(node, trail) {
  const next = node.name ? [...trail, node.name] : trail;
  nameById.set(node.id, next);
  for (const child of node.children ?? []) walk(child, next);
})(file.document, []);

function place(comment) {
  const nodeId = comment.client_meta?.node_id;
  if (!nodeId) return "（画面に紐づかないコメント）";
  const trail = nameById.get(nodeId);
  if (!trail) return `ノード ${nodeId}`;
  // ページ名は冗長なので、末尾2つ（セクション / フレーム）だけ出す
  return trail.slice(-2).join(" / ");
}

const threads = comments.filter((c) => !c.parent_id);
const repliesByParent = new Map();
for (const c of comments) {
  if (c.parent_id) repliesByParent.set(c.parent_id, [...(repliesByParent.get(c.parent_id) ?? []), c]);
}

const target = showAll ? threads : threads.filter((c) => !c.resolved_at);
if (target.length === 0) {
  console.log(showAll ? "コメントはありません。" : "未解決のコメントはありません（--all で解決済みも見られます）。");
  process.exit(0);
}

const byPlace = new Map();
for (const c of target) {
  const key = place(c);
  byPlace.set(key, [...(byPlace.get(key) ?? []), c]);
}

console.log(`\n${target.length} 件${showAll ? "" : "（未解決）"}\n`);
for (const [where, list] of byPlace) {
  console.log(`■ ${where}`);
  for (const c of list.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const when = c.created_at.slice(0, 16).replace("T", " ");
    const who = c.user?.handle ?? "?";
    console.log(`  ・${c.message.replace(/\n/g, "\n    ")}`);
    console.log(`    ${who} / ${when} / id=${c.id}${c.resolved_at ? " / 解決済み" : ""}`);
    for (const r of repliesByParent.get(c.id) ?? []) {
      console.log(`    └ ${r.user?.handle ?? "?"}: ${r.message.replace(/\n/g, " ")}`);
    }
  }
  console.log("");
}
console.log('返信する:  npm run design:comments -- --reply <id> "本文"');
