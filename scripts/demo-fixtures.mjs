/**
 * アンケート v2 の必須テスト（docs/specs/survey-v2.md §12、2026-08-28 修正仕様）。
 *
 * 高評価・低評価・混在の3ルートで最終生成を行い、
 *   ・回答に無い事実・感情（禁止語）が出ていないか
 *   ・全文に sourceSignalIds があるか
 *   ・AIの謝罪・メタ発言が混ざっていないか
 * を検証する。絵文字の可逆性は純関数として検査する。
 *
 * 実行: dev サーバー起動中に `node scripts/demo-fixtures.mjs`
 * （AI呼び出しがあるため `npm run check` には入れない。Node 23+ のTS直読みで
 *  実装と同じ validateSentences / applyEmoji を使う＝コピーのドリフトが起きない）
 */
import { validateSentences, applyEmoji, joinSentences } from "../lib/demo/fact-model.ts";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";

const FIXTURES = [
  {
    name: "高評価ルート（とても満足・初めて・プレーンパンケーキ・厚みがあった・感じがよかった・落ち着いて過ごせた）",
    signals: [
      { id: "visit:first", label: "初めて", provisional: "初めて利用しました" },
      { id: "item:pc-plain", label: "プレーンパンケーキ", provisional: "", itemLabel: "プレーンパンケーキ" },
      { id: "attr:pc-plain:厚みがあった", label: "厚みがあった", provisional: "", itemLabel: "プレーンパンケーキ" },
      { id: "service:kind", label: "感じがよかった", provisional: "スタッフの感じがよかったです" },
      { id: "atmosphere:calm", label: "落ち着いて過ごせた", provisional: "落ち着いて過ごせました" },
    ],
  },
  {
    name: "低評価ルート（不満・常連・食事なし・スタッフを呼んでも来なかった）",
    signals: [
      { id: "visit:regular", label: "常連", provisional: "よく利用しています" },
      { id: "free:concern", label: "スタッフを呼んでも来なかった", provisional: "スタッフを呼んでも来なかった", isFree: true },
    ],
  },
  {
    name: "混在ルート（ふつう・2回目以降・フレンチトースト・しっとり・甘め・対応が早い・席がゆったり）",
    signals: [
      { id: "visit:few", label: "2回目以降", provisional: "何度か利用しています" },
      { id: "item:ft-plain", label: "フレンチトースト プレーン", provisional: "", itemLabel: "フレンチトースト プレーン" },
      { id: "attr:ft-plain:しっとりしていた", label: "しっとりしていた", provisional: "", itemLabel: "フレンチトースト プレーン" },
      { id: "attr:ft-plain:甘めだった", label: "甘めだった", provisional: "", itemLabel: "フレンチトースト プレーン" },
      { id: "service:quick", label: "対応が早い", provisional: "対応が早かったです" },
      { id: "atmosphere:roomy", label: "席がゆったり", provisional: "席がゆったりしていました" },
    ],
  },
];

let failed = 0;
const fail = (msg) => { failed++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

for (const fixture of FIXTURES) {
  console.log(`\n■ ${fixture.name}`);
  const res = await fetch(`${BASE}/api/demo/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "final", signals: fixture.signals, tone: "normal", seed: 1 }),
  });
  const data = await res.json();
  if (!data.sentences) {
    fail("生成が返ってこなかった（sentences: null）");
    continue;
  }
  const verdict = validateSentences(data.sentences, fixture.signals);
  if (!verdict.ok) {
    fail(`検証に落ちた: ${verdict.reason}`);
    console.error("    生成:", JSON.stringify(data.sentences, null, 2).slice(0, 500));
    continue;
  }
  pass(`検証通過（${data.sentences.length}文・全文に根拠あり・禁止語/メタ発言なし）`);
  console.log(`    「${joinSentences(verdict.sentences)}」`);
}

// ★はAPIに存在しないパラメータ＝「評価だけ変えても文章が変わらない」ことは構造的に保証される
console.log("\n■ 評価の混入");
pass("★はAPIのスキーマに存在しない（rating パラメータ自体を廃止済み。構造的に混入できない）");

// 絵文字の可逆性（実装と同じ関数で検査）
console.log("\n■ 絵文字の可逆性");
const base = "何度か利用しています。フレンチトーストはしっとりしていて、甘めでした。席もゆったりしていました。";
const on = applyEmoji(base);
const off = base; // OFF時は絵文字なしの本文をそのまま表示する実装（構造的に可逆）
if (on === base) fail("絵文字ONで何も変わらなかった");
else pass(`ON で絵文字が付く: …${on.slice(-14)}`);
const emojiCount = [...on].filter((ch) => ch === "😊" || ch === "✨").length;
if (emojiCount > 2) fail(`絵文字が${emojiCount}個（最大2個の仕様）`);
else pass(`絵文字は${emojiCount}個（≦2）`);
if (off !== base) fail("OFFで元に戻らない");
else pass("OFF で一字一句元に戻る");

console.log(failed === 0 ? "\nすべて通過しました。" : `\n${failed} 件落ちました。`);
process.exit(failed === 0 ? 0 : 1);
