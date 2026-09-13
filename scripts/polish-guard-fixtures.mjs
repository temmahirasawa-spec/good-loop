/**
 * v4「文にする」の検査層の必須テスト（docs/specs/survey-v4.md §6-4）。
 *
 * **AIを呼ばない純粋な検査。** 実装と同じ関数を直接読むので、コピーのドリフトが起きない。
 * ここが通ることが「AIが助詞と句読点しか足せない」ことの機械的な証明になる。
 *
 * 実行: `npm run survey:guard`
 * ⚠ Node のTS直読み（23.6+）を使うため `npm run check` には入れない
 *   （CI は Node 22。scripts/demo-fixtures.mjs と同じ扱い）。
 */
import { GUARD_WORDS } from "../lib/demo/fact-model.ts";
import { guardPolished, similarity, politenessOk } from "../lib/survey/polish-guard.ts";

/** [名前, 本人が書いた文字列, AIが返した1文, 期待（true=通す / false=捨てる）] */
const CASES = [
  ["助詞と句読点を足しただけ", "パンケーキふわふわ 接客もよかった", "パンケーキがふわふわで、接客もよかった。", true],
  ["すでに読める文はそのまま", "今日は席がゆったりしていて過ごしやすかった", "今日は席がゆったりしていて過ごしやすかった。", true],
  ["単語の羅列に助詞を足す", "抹茶ラテ 苦味つよめ", "抹茶ラテは苦味つよめ。", true],
  ["話しことばを残したまま整える", "パンケーキめっちゃうまかった でも待った", "パンケーキめっちゃうまかった、でも待った。", true],

  ["語尾を です に変えた", "接客よかった 席もゆったりしてた", "接客がよかったです、席もゆったりしてたです。", false],
  ["語尾を ました に変えた", "パンケーキ食べた", "パンケーキを食べました。", false],
  ["言い換えた（ふわふわ→ふんわり）", "パンケーキふわふわ", "パンケーキがふんわり。", false],
  ["無い語を足した（また来たい）", "パンケーキふわふわ", "パンケーキがふわふわで、また来たい。", false],
  ["無い語を足した（おいしい）", "ボリュームあった", "ボリュームがあっておいしい。", false],
  ["評価の語を足した（最高）", "接客よかった", "接客が最高によかった。", false],
  ["語順を入れ替えた", "接客よかった 料理も早い", "料理も早く、接客がよかった。", false],
  ["2文にした", "パンケーキふわふわ 接客もよかった", "パンケーキがふわふわ。接客もよかった。", false],
  ["長くしすぎた", "待った", "待った時間がとても長く感じられて、少し気になった。", false],
  ["メタ発言", "接客よかった", "申し訳ありませんが、整えられませんでした", false],
  ["本人の文字を消した", "抹茶ラテ 苦味つよめ", "抹茶ラテは苦味。", false],
  ["空", "接客よかった", "   ", false],
];

let failed = 0;
for (const [name, input, output, expected] of CASES) {
  const verdict = guardPolished(input, output, GUARD_WORDS);
  const got = verdict.ok;
  const mark = got === expected ? "  OK  " : "* NG *";
  if (got !== expected) failed++;
  const reason = verdict.ok ? "" : `（${verdict.reason}）`;
  console.log(`${mark} ${name}\n       入力: ${input}\n       出力: ${output}\n       判定: ${got ? "通す" : "捨てる"}${reason} / 期待: ${expected ? "通す" : "捨てる"}`);
}

/**
 * 敬体化の禁止を単独でも確かめる。
 *
 * ⚠ 仕様にあった「挿入は連続2文字以内なので『です』『ました』は構造的に通らない」は**誤り**。
 *   「です」は2文字、「ました」も入力の「た」と一致させれば2文字挿入で作れる。
 *   このテストが実際にそれを捕まえたので、専用の検査（politenessOk）を足した。
 */
const structural = [
  ["です は通らない", politenessOk("接客よかった", "接客がよかったです"), false],
  ["ます は通らない", politenessOk("待った", "待ちます"), false],
  ["ました は通らない", politenessOk("パンケーキ食べた", "パンケーキを食べました"), false],
  ["本人が です と書いていれば通る", politenessOk("接客よかったです", "接客がよかったです"), true],
  ["ので（2文字の助詞）は通る", politenessOk("待った 帰った", "待ったので、帰った"), true],
];
for (const [name, got, expected] of structural) {
  const mark = got === expected ? "  OK  " : "* NG *";
  if (got !== expected) failed++;
  console.log(`${mark} ${name} → ${got}`);
}

// 似すぎ検出
const a = "パンケーキがふわふわで、接客もよかった。";
const b = "パンケーキがふわふわで、接客もとてもよかった。";
const c = "駐車場が広くて助かった。";
const sim = [
  ["ほぼ同じ文は似すぎと判定する", similarity(a, b) >= 0.35, true],
  ["違う文は似すぎと判定しない", similarity(a, c) >= 0.35, false],
];
for (const [name, got, expected] of sim) {
  const mark = got === expected ? "  OK  " : "* NG *";
  if (got !== expected) failed++;
  console.log(`${mark} ${name}`);
}
console.log(`\n類似度: ほぼ同じ ${similarity(a, b).toFixed(2)} / 別の話題 ${similarity(a, c).toFixed(2)}`);

if (failed > 0) {
  console.error(`\n${failed} 件が期待と違います`);
  process.exit(1);
}
console.log(`\n全 ${CASES.length + structural.length + sim.length} 件が期待どおりです`);

/**
 * 2026-09-13 の実測で見つかった欠陥の回帰テスト。
 * AIが助詞の前後に空白を入れた出力が、検査を通ってしまっていた。
 */
const spacing = [
  ["助詞の前後に空白を入れた出力は通さない", guardPolished("フレンチトースト しっとり 甘さちょうどいい", "フレンチトースト は しっとり で 甘さ ちょうどいい 。", GUARD_WORDS).ok, false],
  ["入力にあった空白はそのまま残せる", guardPolished("コーヒー ぬるかった", "コーヒー ぬるかった。", GUARD_WORDS).ok, true],
];
let spacingFailed = 0;
for (const [name, got, expected] of spacing) {
  const mark = got === expected ? "  OK  " : "* NG *";
  if (got !== expected) spacingFailed++;
  console.log(`${mark} ${name}`);
}
if (spacingFailed > 0) {
  console.error(`\n空白の回帰テストが ${spacingFailed} 件 失敗`);
  process.exit(1);
}

/**
 * 2026-09-13 のレビューで**実際に破られた**穴の回帰テスト。
 * ここが落ちるということは、「AIは助詞と句読点しか足していない」という保証が壊れているということ。
 */
const breaches = [
  // ① ひらがな2文字の挿入で意味が反転した（いちばん重い）
  ["意味の反転を通さない（よかった→よくなかった）", "席ゆったり 接客よかった", "席はゆったり、接客はよくなかった。", false],
  ["意味の反転を通さない（安かった→安くなかった）", "値段安かった", "値段は安くなかった。", false],
  ["否定の挿入を通さない（また来たい→また来たくない）", "パンケーキふわふわ また来たい", "パンケーキがふわふわで、また来たくない。", false],
  // ② ！／？ で何文でも作れた
  ["！で3文にした出力を通さない", "料理早い 接客よかった 店きれい", "料理が早い！接客もよかった！店もきれい！", false],
  ["断定を疑問に変える出力を通さない", "衛生的だった 値段安い", "衛生的だった？値段は安い？", false],
  // ③ 入力に1つあれば です を足し放題だった
  ["です を増やす出力を通さない", "常連です 今日も早かった", "常連です、今日も早かったです", false],
  ["本人が書いた です はそのまま通る", "常連です 今日も早かった", "常連です、今日も早かった", true],
  // ④ 記号で意味を足せた
  ["カギカッコの挿入を通さない", "スタッフ親切だった 料理早い", "スタッフは「親切」だった、料理も早い", false],
  ["三点リーダの挿入を通さない", "接客よかった", "接客は、よかった…", false],
  // 通るべきものが通り続けることの確認（実測で出た本物の出力）
  ["実測の出力はそのまま通る①", "店員さん 説明ていねいだった", "店員さんの説明がていねいだった。", true],
  ["実測の出力はそのまま通る②", "オムライス とろとろ 量おおめ", "オムライスはとろとろで量おおめ。", true],
  ["実測の出力はそのまま通る③", "ケーキ 甘さひかえめ コーヒーとあう", "ケーキは甘さひかえめで、コーヒーとあう。", true],
  ["実測の出力はそのまま通る④", "値段ちょっと高い でも量おおい", "値段ちょっと高いでも量おおい。", true],
  ["実測の出力はそのまま通る⑤", "スタッフさん 名前おぼえててくれた", "スタッフさんが名前おぼえててくれた。", true],
];
let breachFailed = 0;
for (const [name, input, output, expected] of breaches) {
  const verdict = guardPolished(input, output, GUARD_WORDS);
  const mark = verdict.ok === expected ? "  OK  " : "* NG *";
  if (verdict.ok !== expected) breachFailed++;
  console.log(`${mark} ${name}${verdict.ok ? "" : `（${verdict.reason}）`}`);
}
if (breachFailed > 0) {
  console.error(`\n破られた穴の回帰テストが ${breachFailed} 件 失敗`);
  process.exit(1);
}
console.log("\n破られた穴の回帰テスト: 全通過");
