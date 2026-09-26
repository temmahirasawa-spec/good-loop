/**
 * v5「続きを聞く」の検査層（docs/specs/survey-v5.md §5）。
 *
 * **AIの自己申告を信じない。** 返ってきた「問い」が、次の条件をすべて満たすかを**文字だけで**確かめる。
 *   ・問いが1つだけで、「？」で終わる（感想の文を返していない）
 *   ・開いた問いである（何・どんな・どの・どう…を含む）。「海は見えましたか？」のような
 *     はい／いいえで答える問いは、答えの中身を先に決めてしまうので捨てる
 *   ・評価の言葉・ほめ言葉が入っていない（本人がすでに書いた語は除く）
 *   ・場所や店名を聞いていない（そのお店での体験だと分かっている）
 *   ・年齢や名前など、個人のことを聞いていない
 *   ・前置きや謝罪などのメタ発言でない
 *   ・直前に出した問いと同じでない
 *
 * 1つでも落ちたら問いを捨て、画面には**何も出さない**（エラー文言も出さない）。
 *
 * 根拠：2026-09-26 の実測（Haiku 45回）。直す前のプロンプトでは「どこでパスタを食べましたか？」
 * （店にいるのに場所を聞く）や「どんな工夫や配慮を感じましたか？」（良い方向への誘導）が出た。
 * プロンプトで禁じても破られることは v4 で実証済みなので、ここで機械的に止める。
 *
 * ⚠ **このファイルは他のモジュールを import しません。**
 *   `scripts/ask-guard-fixtures.mjs` が Node のTS直読みでこのファイルを直接読むため
 *   （polish-guard.ts と同じ理由。Node は拡張子なしの相対 import を解決できない）。
 */

/**
 * 問いの長さの上限（プロンプトは「20字くらい、長くても25字」を求めている）。
 * スマホで2行に収まる長さ。2026-09-26 の実測では、本人の語をなぞった問いが26字前後になることがあった
 */
export const ASK_MAX_CHARS = 32;
/** 入力（本文）の上限。これを超えたら問いを作らない */
export const ASK_MAX_INPUT_CHARS = 400;

/**
 * 開いた問いの印。どれか1つを含む問いだけを通す。
 * 「覚えていることは？」のように疑問詞が無くても開いている形は、末尾の型で拾う。
 */
const OPEN_MARKERS = ["何", "なに", "なん", "どんな", "どの", "どう", "どれ", "どこ", "どちら", "いくつ", "いくら", "どういう"];
const OPEN_ENDINGS = ["ことは？", "ところは？", "ものは？"];

/**
 * 問いに入れてはいけない評価の言葉（**本人が本文に書いた語なら通す**）。
 * 本人が「ていねいだった」と書いたあとに「どこがていねいでしたか？」と聞くのは、
 * 本人の評価をなぞっているだけで、中身を足していないため。
 */
const EVALUATIVE = [
  "よかっ", "良かっ", "よい", "良い", "いい", "悪い", "わるい",
  "おいし", "美味", "うまか", "うまい", "まずい",
  "気持ちよ", "気持ちい", "最高", "最悪", "残念", "印象的",
  "工夫", "配慮", "こだわり", "おもてなし", "丁寧", "ていねい",
  "素敵", "すてき", "素晴", "すばらし", "満足", "不満",
  "楽し", "嬉し", "うれし", "感動", "感謝", "快適", "心地よ",
  "おすすめ", "お勧め", "オススメ", "また来", "リピート", "参考に", "役に立", "助か",
];

/**
 * どのお店かを聞く形（そのお店での体験だと分かっているので聞かない）。
 *
 * ⚠「どこで」だけを禁止にはしない。「どこで待ちましたか？」「どこの席でしたか？」のような
 *   **店の中の場所**を聞く問いは正当で、v4 の固定の問い（topic-questions.ts）にも入っている。
 *   落とすのは「どこでパスタを食べましたか？」のように、食べた・来た店そのものを聞く形だけ。
 */
const PLACE = [
  /(どこ|どちら)で.*(食べ|飲ん|飲み|買|行|来|利用)/,
  /(どこ|どちら)の(お店|店)/,
  /店名|お店の名前/,
];

/** 個人のことを聞く言葉 */
const PERSONAL = ["年齢", "何歳", "歳", "名前", "職業", "住所", "連絡先", "電話", "性別", "学校", "会社"];

/** メタ発言・前置き */
const META = ["申し訳", "できません", "以下", "承知", "AI", "質問", "回答", "お答え"];

export type AskVerdict = { ok: true; question: string } | { ok: false; reason: string };

/** 比べるときの正規化：空白を除き、半角の「?」を全角にそろえる */
function normalize(text: string): string {
  return text.replace(/\s+/g, "").replace(/\?/g, "？");
}

export function guardQuestion(input: string, candidate: string, avoid: readonly string[] = []): AskVerdict {
  const q = normalize(candidate ?? "");
  if (!q) return { ok: false, reason: "empty" };
  if (/[\r\n]/.test(candidate)) return { ok: false, reason: "multiline" };
  if (Array.from(q).length > ASK_MAX_CHARS) return { ok: false, reason: "too-long" };

  // 問いは1つだけで、「？」で終わる
  const marks = (q.match(/？/g) ?? []).length;
  if (marks !== 1 || !q.endsWith("？")) return { ok: false, reason: "not-a-single-question" };
  if (/[！!「」『』]/.test(q)) return { ok: false, reason: "decorated" };

  // 開いた問いだけを通す（はい／いいえの問いは答えの中身を先に決めてしまう）
  const open = OPEN_MARKERS.some((w) => q.includes(w)) || OPEN_ENDINGS.some((w) => q.endsWith(w));
  if (!open) return { ok: false, reason: "closed-question" };
  // 「何か〜ありますか？」「何か〜しましたか？」は疑問詞を含んでも、実質は「はい／いいえ」の問い
  // （2026-09-26 の実機で「何か参考になったことはありますか？」「何か行動に移しましたか？」が出た）
  if (/何か[^？]*(ますか|ましたか|でしたか)？$/.test(q)) return { ok: false, reason: "closed-question" };

  const body = normalize(input ?? "");
  const evaluative = EVALUATIVE.find((w) => q.includes(w) && !body.includes(w));
  if (evaluative) return { ok: false, reason: `evaluative:${evaluative}` };
  if (PLACE.some((re) => re.test(q))) return { ok: false, reason: "place" };
  const personal = PERSONAL.find((w) => q.includes(w));
  if (personal) return { ok: false, reason: `personal:${personal}` };
  const meta = META.find((w) => q.includes(w));
  if (meta) return { ok: false, reason: `meta:${meta}` };

  // 直前に出した問いと同じなら出さない（A2 で「別の角度の問い」を頼んだときに同じものが返ることがある）
  if (avoid.some((a) => normalize(a) === q)) return { ok: false, reason: "repeat" };

  return { ok: true, question: q };
}
