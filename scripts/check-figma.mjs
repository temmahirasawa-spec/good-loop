#!/usr/bin/env node
/**
 * Figma デザイン検品スクリプト
 *
 *   npm run design:figma                        検品する
 *   npm run design:figma -- --update-baseline   今の違反を「既存分」として記録し直す
 *
 * 前提:
 *   環境変数 FIGMA_TOKEN に Figma のパーソナルアクセストークン（file_content:read）を入れる。
 *   ~/.zshrc に  export FIGMA_TOKEN="figd_..."  と書く。リポジトリには絶対に置かない。
 *   （現行トークンの有効期限は 2026-11-01。切れると 403 で落ちる ── CLAUDE.md 4章参照）
 *
 * 対象: GOOD REVIEW 専用ファイルの全ページ（SKIP_PAGES に書いたものを除く）。
 *   このファイルの中身はすべて GOOD REVIEW のもの。だから除外リスト方式にしてある
 *   （新しいページを作ったら、登録しなくても自動的に検品の対象に入る）。
 *   共通トークンと共通コンポーネントは UTUTU 側のライブラリにあり、ここでは見ない。
 *   セクションを使っていないページは構造チェックをスキップする（作りかけ・素材置き場のため）。
 *
 * 考え方:
 *   scripts/figma-check-baseline.json は「既存分として見逃す違反」の一覧。
 *   2026-08-05 時点で 252件（余白がスケール外249 ＋ 生フレーム3）。
 *   余白の249件は全部が探索用・色見本のセクション。設計の本線は0件。
 *   ここが増えるのは、返済されない負債がさらに増えたということ。台帳は docs/handoff.md。
 *   構造・パディング・セクション色は、ベースラインに関係なく必ず落とす。
 */

import fs from "node:fs";
import path from "node:path";

// GOOD REVIEW 専用ファイル。中身はすべて GOOD REVIEW のもの
// （共通トークンとコンポーネントは UTUTU 側のライブラリに置く）
const FILE_KEY = "i7z9wGL6BpFoC2kwlGA1lV";

/**
 * 検品しないページ（除外リスト）。
 *
 * このファイルは GOOD REVIEW 専用なので、**除外リスト方式**にしてある。
 * 新しく作ったページは、何もしなくても検品の対象に入る。
 * 許可リスト方式だと、ページを足した人が登録を忘れた分が黙って見逃される。
 *
 * `---` はページ一覧の見た目を区切るためだけの空ページ。
 *
 * `MTG` は打ち合わせ資料の置き場。**画面ではないので検品しない。**
 *   スライドは画面の規約（PC/SP の対・セクション色・100pxパディング・余白のスケール）に
 *   従う必要が無く、そのまま検品すると1回の資料で数百件の違反が積み上がる。
 *   台帳は返済の作業リストなので、返済する気の無いものを載せると読めなくなる。
 *   **打ち合わせ資料はこのページに置くこと**（`docs/specs/design-rules.md` 3章）。
 */
const SKIP_PAGES = ["---", "MTG"];

/**
 * 検品しないセクション（2026-08-22、天真の判断）。
 *
 * **色やロゴを「いろいろ試す」ためのボード**で、画面ではない。
 * ここにコンポーネントを使わせると、**色違いを見比べるという目的そのものが壊れる**
 * （インスタンスにするとコンポーネント側の色になってしまう）。
 * PC / SP の対を要求しても意味がない。MTG ページと同じ理由で対象から外す。
 *
 * **画面を作るセクションをここに入れないこと。** 入れた瞬間、その画面は誰にも検査されなくなる。
 */
const SKIP_SECTIONS = [
  "03 Explore / Color Patterns",
  "04 Explore / Blue Themes",
  "05 Explore / Brand Direction",
  "06 Explore / Logo Refinement",
];

/**
 * 全セクションに PC / SP の対を要求するページ（画面制作のページ）。
 * ここに無いページでも、サブセクションを作った時点で PC / SP の対が必須になる。
 * 画面制作ページを作ったら、このリストに足すこと。
 *
 * `Components` は入れない。コンポーネントの置き場であって画面ではないため
 * （PC版のボタン・SP版のボタン、という作り分けはしない）。
 */
const SCREEN_PAGES = ["App Design Master", "Web Design Master"];

/**
 * PC / SP の対を要求しないセクション（片側しか存在しない画面）。
 *
 * 来店客は卓上POPのQRから開くので、**お客様side の画面は SP しか作らない**
 * （CLAUDE.md 4章「来店客側はスマホが主」）。実測でも、以下のセクションの中身は
 * すべて 390px 幅のフレームだけだった。ここに PC を要求しても、作る意味のない
 * PC版を9業態ぶん作らせるだけになる。
 *
 * 逆に `07 管理画面`（店舗側の管理画面）は PC が主なので、ここには入れない。
 *
 * **このリストに入れたセクションは、タップ領域44px以上の検査対象になる**（＝SP扱い）。
 * 対を免除するかわりに、SPとしての品質は見る。
 *
 * ページ名やセクション名を変えたら、ここも直すこと。
 * 実在しない名前が残っていたら、下の実行部で落ちる。
 */
const PAIR_EXEMPT_SECTIONS = [
  "01 Rating UI Exploration / 評価UI 5案（A=デフォルト）",
  "02 基本形 / 画面遷移図（390×844）",
  // 業態別の 390×844 フレームが8枚並んでいるだけ。色の確認用で、PC版は存在しない
  "03 テーマカラー / 業態別（02画面で色確認）",
];

/**
 * セクションの色（docs/specs/design-rules.md 3章）。
 *   大枠（最上位セクション）  #7E7E7E
 *   中枠（PC / SP）           #444444
 * 目で見て階層が分かる状態を保つための規約。機械で判定する。
 */
const SECTION_COLOR_OUTER = "#7E7E7E";
const SECTION_COLOR_INNER = "#444444";

const PAD = 100;
const TOL = 2;
const TAP_MIN = 44;

const BASELINE_PATH = path.join(process.cwd(), "scripts", "figma-check-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error("FIGMA_TOKEN が設定されていません。");
  console.error('~/.zshrc に  export FIGMA_TOKEN="figd_..."  を追加して、ターミナルを開き直してください。');
  process.exit(1);
}

const hard = [];  // 構造・パディング・セクション色（既存分も必ず落とす）
const soft = [];  // 資産の質（ベースラインに無いものだけ落とす）
const info = [];  // 参考
const skipped = [];
const stats = { unboundFills: 0, noTextStyle: 0, nodes: 0 };

const box = (n) => n.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };

/**
 * フレーム1枚が PC 用か SP 用か（2026-08-22、PCとSPを同じセクションに置く構成の導入）。
 * 名前の「— SP」「— PC」を第一の根拠にし、書かれていない場合だけ幅で判断する
 * （SPフレームは390px、モーダルはPC側で560px前後）。
 */
const SP_MAX_WIDTH = 430;
const isSpFrame = (n) => /[-—]\s*SP\b/i.test(n.name || "") || (!/[-—]\s*PC\b/i.test(n.name || "") && box(n).width <= SP_MAX_WIDTH);
const isPcFrame = (n) => !isSpFrame(n);
const near = (a, b) => Math.abs(a - b) <= TOL;
const H = (sec, msg) => hard.push({ sec, msg });
const S = (sec, msg) => soft.push({ sec, msg });
const I = (sec, msg) => info.push({ sec, msg });

/** Figma の 0〜1 の RGB を #RRGGBB に直す */
const toHex = (c) =>
  "#" + ["r", "g", "b"].map((k) => Math.round((c[k] ?? 0) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

/** セクションの塗り（＝Figma上の枠の色）を取り出す。単色でなければ null */
function sectionColor(node) {
  const fill = (node.fills || []).find((f) => f && f.type === "SOLID" && f.visible !== false);
  return fill && fill.color ? toHex(fill.color) : null;
}

function checkSectionColor(label, node, expected, kind) {
  const actual = sectionColor(node);
  if (actual === null) {
    H(label, `${kind}セクションに単色の塗りがありません（${expected} にしてください）`);
  } else if (actual !== expected.toUpperCase()) {
    H(label, `${kind}セクションの色が ${actual} です（${expected} にしてください）`);
  }
}

async function fetchFile() {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    console.error(`Figma API エラー: ${res.status} ${res.statusText}`);
    if (res.status === 403) {
      console.error("トークンが無効か期限切れ、またはこのファイルへの権限がありません。");
      console.error("（トークンの有効期限は 2026-11-01。切れていたら Figma で発行し直して ~/.zshrc を更新する）");
    }
    process.exit(1);
  }
  return res.json();
}

// ── ページ ────────────────────────────────────────────
function checkPage(page) {
  const sections = (page.children || []).filter((c) => c.type === "SECTION" && !SKIP_SECTIONS.includes(c.name));
  const loose = (page.children || []).filter((c) => c.type !== "SECTION");

  if (!sections.length) {
    skipped.push(`${page.name}（セクション未使用）`);
    return;
  }
  for (const l of loose) {
    H(page.name, `セクションに入っていない要素があります: 「${l.name}」（${l.type}）`);
  }

  const sorted = sections.slice().sort((a, b) => box(a).y - box(b).y);
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const b = box(s);
    if (!near(b.x, 0)) H(`${page.name} / ${s.name}`, `セクションの x が 0 ではありません（${Math.round(b.x)}）`);
    if (i > 0) {
      const p = box(sorted[i - 1]);
      const gap = b.y - (p.y + p.height);
      if (gap < -TOL) H(`${page.name} / ${s.name}`, `前のセクションと重なっています（${Math.round(-gap)}px）`);
      else if (!near(gap, PAD)) H(`${page.name} / ${s.name}`, `前のセクションとの間隔が ${Math.round(gap)}px です（${PAD}px にしてください）`);
    }
    checkSection(page, s);
  }
}

// ── セクション ────────────────────────────────────────
function checkSection(page, sec, depth = 0) {
  const label = `${page.name} / ${sec.name}`;
  const kids = sec.children || [];
  const subs = kids.filter((c) => c.type === "SECTION");

  // 入れ子の検出（セクションが別のセクションに飲み込まれるとページ構造が壊れる）
  if (depth > 0) {
    H(label, "セクションの中にセクションが入り込んでいます。切り出してください");
    return;
  }
  // 「99 〜」で始まるセクションは素材置き場・メモ置き場。構造は問わない
  const isUtility = /^\s*99/.test(sec.name);
  // 画面制作ページの通常セクションは、PC / SP を必ず持つ
  const requirePair =
    !isUtility &&
    SCREEN_PAGES.includes(page.name) &&
    !PAIR_EXEMPT_SECTIONS.includes(sec.name);

  // 大枠の色
  if (!isUtility) checkSectionColor(label, sec, SECTION_COLOR_OUTER, "大枠の");

  // サブセクションを作った時点で、それは PC / SP 以外あってはならない
  for (const b of subs.filter((s) => s.name !== "PC" && s.name !== "SP")) {
    H(label, `「${b.name}」は PC / SP ではありません。セクションの直下には PC と SP だけを置いてください`);
  }

  if (subs.length) {
    // ── 旧構成：セクション ＞ PC / SP サブセクション ＞ フレーム ──
    const names = subs.map((s) => s.name);
    if (!PAIR_EXEMPT_SECTIONS.includes(sec.name)) {
      if (!names.includes("PC")) H(label, "PC セクションがありません（PC を作るときは SP も対で作る）");
      if (!names.includes("SP")) H(label, "SP セクションがありません（PC を作るときは SP も対で作る）");
    }
    const loose = kids.filter((c) => c.type !== "SECTION");
    if (loose.length) H(label, `PC / SP の外に直接置かれた要素があります: ${loose.map((f) => `「${f.name}」`).join(" ")}`);
    for (const sub of subs) {
      checkSectionColor(`${label} / ${sub.name}`, sub, SECTION_COLOR_INNER, "中枠の");
      checkFit(`${label} / ${sub.name}`, sub, true);
    }
  } else if (requirePair && kids.some((c) => c.type === "FRAME" || c.type === "COMPONENT" || c.type === "COMPONENT_SET")) {
    // ── 新構成（2026-08-22、天真の指示）：セクション ＞ フレーム（PCとSPが同居） ──
    // 機能の軸（トップ・回答一覧・設定・オンボーディング・チュートリアル）でセクションを分け、
    // 同じ機能のPCとSPは同じセクションに置く。サブセクションは作らない。
    // メモのテキストは数に入れない（作り始める前の空セクションを落とさないため）
    const frames = kids.filter((c) => c.type === "FRAME" || c.type === "COMPONENT" || c.type === "COMPONENT_SET");
    if (!frames.some(isPcFrame)) H(label, "PC のフレームがありません（PC を作るときは SP も対で作る）");
    if (!frames.some(isSpFrame)) H(label, "SP のフレームがありません（PC を作るときは SP も対で作る）");
  }

  checkFit(label, sec, false);
}

/** 中身の外接矩形が、ちょうど100pxの余白で収まっているか */
function checkFit(label, node, spaceChildren) {
  const kids = node.children || [];
  if (!kids.length) { I(label, "中身が空です"); return; }
  const nb = box(node);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of kids) {
    const kb = box(k);
    minX = Math.min(minX, kb.x); minY = Math.min(minY, kb.y);
    maxX = Math.max(maxX, kb.x + kb.width); maxY = Math.max(maxY, kb.y + kb.height);
  }
  const l = minX - nb.x, t = minY - nb.y;
  const r = nb.x + nb.width - maxX, b2 = nb.y + nb.height - maxY;
  if (!near(l, PAD)) H(label, `左パディングが ${Math.round(l)}px です（${PAD}px）`);
  if (!near(t, PAD)) H(label, `上パディングが ${Math.round(t)}px です（${PAD}px）`);
  if (!near(r, PAD)) H(label, `右パディングが ${Math.round(r)}px です（${PAD}px）`);
  if (!near(b2, PAD)) H(label, `下パディングが ${Math.round(b2)}px です（${PAD}px）`);

  if (spaceChildren) {
    // PCの行とSPの行が縦に並ぶ構成があるので、**縦に重なっているもの同士＝同じ行**でだけ
    // 横の間隔を見る。行をまたいで比べると、SP行の先頭がPC行の末尾と比較されて誤検知になる。
    const ordered = kids.slice().sort((a, b) => box(a).x - box(b).x);
    for (let i = 1; i < ordered.length; i++) {
      const p = box(ordered[i - 1]), c = box(ordered[i]);
      const sameRow = c.y < p.y + p.height && p.y < c.y + c.height;
      if (!sameRow) continue;
      const gap = c.x - (p.x + p.width);
      if (gap < -TOL) H(label, `「${ordered[i].name}」が前のフレームと重なっています`);
      else if (!near(gap, PAD)) H(label, `「${ordered[i].name}」の左の間隔が ${Math.round(gap)}px です（${PAD}px）`);
    }
  }
}

// ── ノード単位 ─────────────────────────────────────────
// \b で囲まないと "Rectangle" の中の "cta" に誤反応する
const BUTTONISH = /\b(button|btn|chip|cta|tab)s?\b/i;
// 入れ物は対象外。Button Row / Tab Nav / Table Chip Strip など
// **ここに語を足す方向で誤検知を解こうとしないこと。**「CTA Block」「Hero CTAs」のように
// 末尾が容器の語でない入れ物はいくらでも作れるので、語リストは永久に足り続ける。
// 名前ではなく「中身」と「大きさ」で判断する（下の2条件）。
const CONTAINERISH = /\b(row|strip|nav|bar|group|list|wrap|wrapper|content|container|area|section|stack)s?$/i;

/**
 * ボタンとして現実的な高さの上限。これを超えるものはセクション帯や大きなカード。
 * **幅では判定しない。**PC管理画面には横幅864pxの全幅ボタンが実在するため、
 * 幅を条件に入れると本物の生フレームボタンを見逃す。
 */
const RAW_BUTTON_MAX_HEIGHT = 120;

/**
 * 「入れ物」とみなすのに必要な、子孫の INSTANCE / COMPONENT の数。
 *
 * **1個ではダメ。** 生フレームのボタンはたいてい中に Icon インスタンスを1個持っている
 * （`Delete Button` 32×32 の中に `Icon` 1個、など）。1個で除外すると、
 * **本物の生フレームボタンをまとめて見逃す**（実測で11件が消えた）。
 * ボタンを2個以上並べているものは、それ自体がボタンではなく入れ物である。
 */
const CONTAINER_MIN_COMPONENTS = 2;

/** 子孫の INSTANCE / COMPONENT の数を数える（上限に達したら打ち切る） */
function countComponentDescendants(node, limit) {
  let n = 0;
  for (const c of node.children || []) {
    if (c.type === "INSTANCE" || c.type === "COMPONENT") n++;
    if (n >= limit) return n;
    n += countComponentDescendants(c, limit - n);
    if (n >= limit) return n;
  }
  return n;
}

/**
 * 枠に対してこの割合以上の大きさの子は、「その枠が包んでいるだけ」の証拠とみなす。
 *
 * 個数だけでは容器と本物を区別できない。どちらもインスタンス1個だからである。
 *   GOOD REVIEW の CTA Block … 342×77 の枠に、342×52 の Loop/Button が1個 → 幅が100%一致。容器
 *   GOOD ORDER の Delete Button … 32×32 の枠に、16×16 の Icon が1個 → 幅は50%。本物のボタン
 * 区別できるのは**大きさの比率**。枠とほぼ同じ大きさのコンポーネントを持つなら、
 * その枠はそれを包んでいるだけである。
 */
const WRAPPED_CHILD_RATIO = 0.9;

/**
 * **直接の子**に、枠とほぼ同じ大きさの INSTANCE / COMPONENT があるか。
 *
 * 子孫まで見てはいけない。深い階層のインスタンスが偶然大きいだけで除外されてしまう。
 */
function wrapsFullSizeComponent(node) {
  const b = box(node);
  if (!(b.width > 0 && b.height > 0)) return false;
  for (const c of node.children || []) {
    if (c.type !== "INSTANCE" && c.type !== "COMPONENT") continue;
    const cb = box(c);
    if (cb.width >= b.width * WRAPPED_CHILD_RATIO) return true;
    if (cb.height >= b.height * WRAPPED_CHILD_RATIO) return true;
  }
  return false;
}

/**
 * 余白のスケール。
 *
 * **スペーシングを用いるのは将来スケールを変える可能性があるからではなく、
 * この数字で組むと美しくなるから。中途半端な数字が交じると崩れていく。**
 *
 * これは Figma の `Spacing` コレクションの写し。実行時に Figma から取れれば
 * そちらを使い、取れないときだけこの表を使う（下の readSpacingScale）。
 */
const SPACING_SCALE_FALLBACK = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128, 160, 192];

/** 検査する余白のプロパティ */
const SPACING_PROPS = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing", "counterAxisSpacing"];

let spacingScale = new Set(SPACING_SCALE_FALLBACK);
let spacingScaleSource = "";

/**
 * Figma の `Spacing` コレクションからスケールを取り出す。
 *
 * `/v1/files/:key` の応答には変数の定義が含まれない（`document` `components`
 * `componentSets` `styles` だけ）。変数の値を返す `/variables/local` は
 * `file_variables:read` スコープが要る（CLAUDE.md 4章）。
 * したがって現状は必ずフォールバックになる。**その事実は出力に明記する。**
 * 将来スコープ付きのトークンに替えたら、ここが自動で本物を拾う。
 */
function readSpacingScale(file) {
  const collections = file.variableCollections || file.variables || null;
  if (collections) {
    const values = new Set();
    for (const c of Object.values(collections)) {
      if (!/spacing/i.test(c.name || "")) continue;
      for (const v of Object.values(c.variables || {})) {
        for (const val of Object.values(v.valuesByMode || {})) {
          if (typeof val === "number") values.add(val);
        }
      }
    }
    if (values.size) {
      spacingScaleSource = `Figma の Spacing コレクションから取得（${values.size}段階）`;
      return values;
    }
  }
  spacingScaleSource =
    "⚠ Figma から取得できないため、スクリプト内の表を使用（file_variables:read スコープが無いため）";
  return new Set(SPACING_SCALE_FALLBACK);
}

/** 浮動小数の誤差を丸める。16.0000001 を 16 として扱うため */
const snap = (x) => (Math.abs(x - Math.round(x)) < 0.01 ? Math.round(x) : x);

/**
 * オートレイアウトの余白がスケールに乗っているか。
 *
 * 合格の条件は2つだけ。
 *   1. Spacing 変数にバインドされている
 *   2. 未バインドでも、値がスケール上にある（0 を含む）
 * どちらでもない値は、意図して置かれた中途半端な数字である。
 *
 * **インスタンスの内部は見ない。**そちらはコンポーネント側で担保する。
 */
function checkSpacing(node, secLabel) {
  if (!node.layoutMode || node.layoutMode === "NONE") return;
  const bound = node.boundVariables || {};
  for (const prop of SPACING_PROPS) {
    const raw = node[prop];
    if (typeof raw !== "number") continue;
    if (bound[prop]) continue;
    const v = snap(raw);
    if (spacingScale.has(v)) continue;
    S(secLabel, `「${node.name}」の余白がスケール外です（${prop}=${v}）`);
  }
}

function walk(node, secLabel, isSP, insideInstance) {
  stats.nodes++;
  const inInst = insideInstance || node.type === "INSTANCE";
  const b = box(node);
  const name = node.name || "";
  const tappable = BUTTONISH.test(name) && !CONTAINERISH.test(name.trim());

  /* 「生フレームのボタン」判定。名前だけで決めると入れ物まで落とすので、3つ除外する。
       1. 子孫に INSTANCE / COMPONENT が2個以上ある → ボタンを並べている入れ物
       2. 高さが RAW_BUTTON_MAX_HEIGHT を超える → ボタンではない（セクション帯・大きなカード）
       3. 直接の子に、枠とほぼ同じ大きさの INSTANCE / COMPONENT がある
          → そのコンポーネントを包んでいるだけの容器（個数では 1 と区別できない）
     SPのタップ領域の判定（下）はこの除外を通していない。あちらは高さ44px未満が対象で、
     2 とは排他だし、1 で緩めると本物の小さすぎるボタンを見逃す可能性があるため。 */
  if (!inInst && node.type === "FRAME" && tappable) {
    const manyComponents =
      countComponentDescendants(node, CONTAINER_MIN_COMPONENTS) >= CONTAINER_MIN_COMPONENTS;
    const tooTall = b.height > RAW_BUTTON_MAX_HEIGHT;
    const wrapsOne = wrapsFullSizeComponent(node);
    if (!manyComponents && !tooTall && !wrapsOne) {
      S(secLabel, `「${name}」が生のフレームで作られています。既存のコンポーネントを使ってください`);
    }
  }
  if (isSP && !insideInstance && tappable && b.height > 0 && b.height < TAP_MIN) {
    S(secLabel, `「${name}」の高さが ${Math.round(b.height)}px です（SPのタップ領域は${TAP_MIN}px以上）`);
  }
  // インスタンスの内部は見ない（コンポーネント側で担保する）
  if (!inInst) checkSpacing(node, secLabel);
  if (!inInst) {
    for (const p of [].concat(node.fills || [], node.strokes || [])) {
      if (p && p.type === "SOLID" && p.visible !== false) {
        const bound = node.boundVariables && node.boundVariables.fills;
        if (!bound && !node.styles) stats.unboundFills++;
      }
    }
    if (node.type === "TEXT" && !(node.styles && node.styles.text)) stats.noTextStyle++;
  }
  for (const c of node.children || []) walk(c, secLabel, isSP, inInst);
}

// ── 実行 ──────────────────────────────────────────────
const file = await fetchFile();
spacingScale = readSpacingScale(file);
const pages = (file.document.children || []).filter((p) => !SKIP_PAGES.includes(p.name));

// 設定に書いた名前が Figma に実在するかを先に照合する。
// 名前を変えたときに、設定だけ古いまま「見ているつもりで見ていない」状態になるのを防ぐ。
{
  const pageNames = new Set(pages.map((p) => p.name));
  const sectionNames = new Set(
    pages.flatMap((p) => (p.children || []).filter((c) => c.type === "SECTION").map((c) => c.name))
  );
  const stale = [
    ...SCREEN_PAGES.filter((n) => !pageNames.has(n)).map((n) => `SCREEN_PAGES のページ「${n}」`),
    ...PAIR_EXEMPT_SECTIONS.filter((n) => !sectionNames.has(n)).map((n) => `PAIR_EXEMPT_SECTIONS のセクション「${n}」`),
  ];
  if (stale.length) {
    console.error("scripts/check-figma.mjs の設定が Figma と食い違っています。\n");
    for (const s of stale) console.error(`  ・${s} が見つかりません`);
    console.error("\n名前が変わったか削除された可能性があります。設定を直してください。");
    process.exit(1);
  }
}

for (const page of pages) {
  checkPage(page);
  for (const sec of page.children || []) {
    if (sec.type !== "SECTION") continue;
    if (SKIP_SECTIONS.includes(sec.name)) continue;
    const subs = (sec.children || []).filter((c) => c.type === "SECTION");
    if (subs.length) {
      // PC / SP に分かれているなら、どちらであるかは名前で決まる。
      // 免除セクションでも、その中の PC を SP 扱いにしてはいけない
      // （1440px の LP に「タップ領域44px以上」を要求することになる）
      for (const sub of subs) walk(sub, `${page.name} / ${sec.name} / ${sub.name}`, sub.name === "SP", false);
    } else {
      // 分かれていないセクションは、フレーム1枚ごとに PC / SP を見分ける
      // （PCとSPが同じセクションに同居する新しい構成。2026-08-22）。
      // ただし素材置き場（99〜）と探索用のページには広げない。1440pxの検討ボードに
      // 「タップ領域44px以上」を要求しても意味がないため、従来どおりの扱いに戻す。
      const spOnly = PAIR_EXEMPT_SECTIONS.includes(sec.name);
      const perFrame = SCREEN_PAGES.includes(page.name) && !/^\s*99/.test(sec.name) && !spOnly;
      for (const kid of sec.children || []) {
        walk(kid, `${page.name} / ${sec.name}`, spOnly || (perFrame && isSpFrame(kid)), false);
      }
    }
  }
}

// ── ベースライン ───────────────────────────────────────
//
// **件数つきで記録する。** キーだけを覚えると「同じ違反が増えたこと」を見逃す。
// 例: 生フレームのボタンが3個あるセクションに、あと10個足しても
//     キーは同じなので、キーだけの台帳では緑のまま通ってしまう。
//
// 判定:
//   キーが台帳に無い          → 落とす（新しい種類の違反）
//   今回の件数 ≤ 台帳の件数    → 通す
//   今回の件数 > 台帳の件数    → 落とす（増えた分だけ落ちる）
//   今回の件数 < 台帳の件数    → 通す。ただし「返済が進んだ」ものとして報告する
//
// 件数が減っても台帳は自動で書き換えない。書き換わるのは --update-baseline を
// 明示的に叩いたときだけ。勝手に基準線が下がると、返済したことに気づけない。
const key = (v) => `${v.sec} :: ${v.msg}`;

/** 今回の検出結果を キー → 件数 にまとめる */
const tally = (list) => {
  const m = new Map();
  for (const v of list) m.set(key(v), (m.get(key(v)) || 0) + 1);
  return m;
};
const current = tally(soft);

// --update-baseline は台帳を読む前に処理して終わる。
// **台帳がまだ無い新規プロジェクトでも、これで最初の1本を作れる。**
if (UPDATE) {
  const counts = {};
  for (const k of Array.from(current.keys()).sort()) counts[k] = current.get(k);
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ total: soft.length, keys: current.size, counts }, null, 2) + "\n"
  );
  console.log(`\n既存分 ${soft.length} 件（${current.size} 種類）を scripts/figma-check-baseline.json に記録しました。\n`);
  process.exit(0);
}

// 台帳がまだ無い＝新規プロジェクトの初回。出力の最後に案内を出すために覚えておく
const baselineExists = fs.existsSync(BASELINE_PATH);

let baseline = { counts: {} };
if (baselineExists) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")); } catch (e) { /* 壊れていたら空として扱う */ }
}
// 旧形式（キーの配列）は件数を持たないので、黙って読み替えない。
// 読み替えると「全部1件ずつ」と誤解して、いきなり大量に落ちる
// ※ 台帳がまだ無い場合はここに入らない（baseline.allowed が undefined のため）。
//    新規プロジェクトの初回は「全部が新しい違反」として出たあと、
//    --update-baseline で台帳を作る、という流れになる。
if (Array.isArray(baseline.allowed)) {
  console.error("scripts/figma-check-baseline.json が旧形式（キーの配列）です。");
  console.error("件数つきの形式に作り直してください:  npm run design:figma -- --update-baseline");
  console.error("※ 作り直す前に、構造・パディングの違反が0件であることを必ず確認すること。");
  process.exit(1);
}
const allowedCounts = new Map(Object.entries(baseline.counts || {}));

/** 台帳との差分。落とすのは「新種」と「増加」だけ */
const fresh = [];     // 台帳に無いキー
const grown = [];     // 増えたキー
const repaid = [];    // 減ったキー（落とさない）
for (const [k, n] of current) {
  if (!allowedCounts.has(k)) { fresh.push({ k, n }); continue; }
  const was = allowedCounts.get(k);
  if (n > was) grown.push({ k, was, n });
  else if (n < was) repaid.push({ k, was, n });
}
// 台帳にあるのに今回1件も出なかった＝全部返済された
for (const [k, was] of allowedCounts) if (!current.has(k)) repaid.push({ k, was, n: 0 });

const freshCount = fresh.reduce((a, v) => a + v.n, 0);
const grownCount = grown.reduce((a, v) => a + (v.n - v.was), 0);
const carried = soft.length - freshCount - grownCount;

// ── 出力 ──────────────────────────────────────────────
const R = "\x1b[31m", Y = "\x1b[33m", G = "\x1b[32m", D = "\x1b[2m", X = "\x1b[0m";
function print(list, color, head) {
  console.log(`${color}${head}${X}`);
  const g = {};
  for (const v of list) (g[v.sec] = g[v.sec] || []).push(v.msg);
  for (const k of Object.keys(g)) {
    const counts = {};
    for (const m of g[k]) counts[m] = (counts[m] || 0) + 1;
    console.log(`\n  ${k}`);
    for (const m of Object.keys(counts)) console.log(`    ${color}・${X}${m}${counts[m] > 1 ? ` ${D}×${counts[m]}${X}` : ""}`);
  }
  console.log("");
}

console.log("");
console.log(`${D}対象ページ: ${pages.map((p) => p.name).join(", ")}${X}`);
console.log(`${D}ノード数 ${stats.nodes}${X}`);
console.log(`${D}余白のスケール: ${spacingScaleSource}${X}\n`);

if (hard.length) print(hard, R, `✗ 構造・パディング・セクション色（${hard.length}件） — 必ず直してください`);
else console.log(`${G}✓ 構造・パディング・セクション色: 全ページ問題なし${X}\n`);

/** キーを「セクション」と「メッセージ」に割り戻して表示する */
const printKeys = (list, color, head, format) => {
  console.log(`${color}${head}${X}`);
  const g = {};
  for (const v of list) {
    const [sec, msg] = v.k.split(" :: ");
    (g[sec] = g[sec] || []).push(format(v, msg));
  }
  for (const sec of Object.keys(g).sort()) {
    console.log(`\n  ${sec}`);
    for (const line of g[sec]) console.log(`    ${color}・${X}${line}`);
  }
  console.log("");
};

if (fresh.length) {
  printKeys(fresh, R, `✗ 新しい種類の違反（${freshCount}件 / ${fresh.length}種類）`,
    (v, msg) => `${msg}${v.n > 1 ? ` ${D}×${v.n}${X}` : ""}`);
}
if (grown.length) {
  printKeys(grown, R, `✗ 増えた違反（+${grownCount}件 / ${grown.length}種類）`,
    (v, msg) => `${msg} ${D}——${X} ${v.was}件で登録されていたものが ${v.n}件に増えています（${R}+${v.n - v.was}${X}）`);
}
if (!fresh.length && !grown.length) console.log(`${G}✓ 新しい違反なし・増えた違反なし${X}\n`);

if (repaid.length) {
  printKeys(repaid, G, `✓ 返済が進んだもの（${repaid.length}種類）— 落としません`,
    (v, msg) => `${msg} ${D}——${X} ${v.was}件 → ${v.n}件`);
  console.log(`${D}  台帳は自動では書き換えません。反映するなら  npm run design:figma -- --update-baseline${X}\n`);
}

if (info.length) print(info, Y, `△ 確認したほうがよいもの（${info.length}件）`);
if (skipped.length) console.log(`${D}スキップ: ${skipped.join(" / ")}${X}`);

console.log(`${D}未返済の負債（ベースラインで見逃している分）: ${carried}件 / ${allowedCounts.size}種類${X}`);
console.log(`${D}今回の検出合計: ${soft.length}件（新種 ${freshCount} ＋ 増加 ${grownCount} ＋ 既存 ${carried}）${X}`);
console.log(`${D}未バインドの塗り: ${stats.unboundFills} / テキストスタイル未適用: ${stats.noTextStyle}${X}\n`);

/* 台帳がまだ無い状態で違反が出たときだけ案内する。
   新規プロジェクトの初回は必ず全件が「新しい種類」として赤く出るので、
   次に何をすればいいかが書かれていないと「壊れている」と誤解される。
   **台帳が既にある場合は出さない。**既存プロジェクトで --update-baseline を
   安易な逃げ道として案内すると、CLAUDE.md 7章（検品を通さずに完了と言わない）に反する。 */
if (!baselineExists && (fresh.length || grown.length)) {
  console.log(`${Y}▶ これは初回の実行です。${X}台帳（scripts/figma-check-baseline.json）がまだ無いため、いま Figma にある違反が全部「新しい種類」として出ています。${Y}壊れているわけではありません。${X}`);
  console.log(`${D}  いまの状態を基準線として登録する:  npm run design:figma -- --update-baseline${X}`);
  console.log(`${D}  ※ 登録する前に、上の「構造・パディング」が0件で終わっていることを必ず確認すること。${X}\n`);
}

process.exit(hard.length || fresh.length || grown.length ? 1 : 0);
