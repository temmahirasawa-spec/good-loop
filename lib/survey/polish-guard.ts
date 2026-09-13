/**
 * v4「文にする」の検査層（docs/specs/survey-v4.md §6-4）。
 *
 * **AIの自己申告を信じない。** 出てきた1文が、本人の書いた文字列から
 * 「助詞と句読点を足しただけ」で作れるかを、**文字だけで**機械的に確かめる。
 *
 * ⚠ 形態素解析器（＝文を単語に割って品詞を判定するライブラリ）は使わない。
 *   このリポジトリの依存に1つも入っておらず、辞書は十数MBある。
 *   「書いてあるのに動かない安全装置」になるほうが危険なので、文字だけで完結させた。
 *
 * 1つでも落ちたら候補を捨て、画面には**何も出さない**（エラー文言も出さない）。
 */

/**
 * ⚠ **このファイルは他のモジュールを import しません。**
 *   禁止語の一覧（`GUARD_WORDS`）は呼び出し側から渡してもらう形にしてあります。
 *   理由は `scripts/polish-guard-fixtures.mjs` が Node のTS直読みでこのファイルを直接読むためで、
 *   Node は拡張子なしの相対 import を解決できません（実測）。
 *   import を足すと**検査の必須テストが動かなくなります**。足さないこと。
 */

/** 禁止語とメタ発言の一覧。実体は `lib/demo/fact-model.ts` の `GUARD_WORDS`（単一の出どころ） */
export type GuardWords = { banned: readonly string[]; meta: readonly string[] };

/** 入力の上限。これを超えたら整形しない（DPの計算量を抑えるため） */
export const MAX_INPUT_CHARS = 400;
/** 出力は入力の何倍までを許すか。**絶対値の上限は置かない**（長さが揃うと、それ自体が「似た文面」になる） */
export const MAX_OUTPUT_RATIO = 1.4;
/** 挿入してよいひらがなの連続数。2にすると「です」(3)「ました」(3)が構造的に通らない */
export const MAX_INSERT_RUN = 2;
/** 同一店舗の直近の本文と、これ以上似ていたら整形結果を返さない（v3実測の中央値0.32が「骨格が同一」だった） */
export const SIMILARITY_THRESHOLD = 0.35;

/** ひらがな（踊り字・長音記号は含めない。語そのものが変わるため） */
function isHiragana(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x3041 && code <= 0x3096;
}

/**
 * 消してよい記号と空白。
 *
 * ⚠ 長音記号（ー）とハイフンは**入れない**。消したり足したりできると
 *   「コーヒー」→「コヒ」のように語そのものが変わってしまう。
 */
function isDeletable(ch: string): boolean {
  return /[\s、。，．！？!?・…「」『』（）()"'`:;：；]/.test(ch);
}

/**
 * 足してよい記号。**空白は入っていない。**
 *
 * ⚠ 2026-09-13 の実測で、空白の挿入を許していたために
 *   「フレンチトースト **は** しっとり **で** 甘さ ちょうどいい 。」という、
 *   助詞の前後に空白が入った不自然な出力が検査を通ってしまった。
 *   日本語の文に空白を足す理由は無いので、**挿入からは外す**（削除は今までどおり許す）。
 */
function isInsertable(ch: string): boolean {
  return /[、。，．！？!?・…「」『』（）()"'`:;：；]/.test(ch);
}

/** 記号・空白かどうか（骨格を取るときに使う） */
function isPunct(ch: string): boolean {
  return isDeletable(ch);
}

export type GuardFailure =
  | "empty"
  | "too-long-input"
  | "not-derivable"
  | "shape"
  | "banned"
  | "meta"
  | "ngram"
  | "politeness"
  | "too-similar";

export type GuardResult = { ok: true; text: string } | { ok: false; reason: GuardFailure };

/**
 * 検査1〜3：文字アライン。
 *
 * 出力が入力から「記号・空白の削除」と「ひらがな（連続2文字まで）・記号・空白の挿入」**だけ**で
 * 作れるかを判定する。両方の走査が前から後ろへしか進まないので、**語順の保存は自動的に保証される**。
 *
 * 状態は (入力のどこまで, 出力のどこまで, 直前に挿入したひらがなの連続数)。
 */
export function isDerivable(input: string, output: string): boolean {
  const a = Array.from(input);
  const b = Array.from(output);
  const n = a.length;
  const m = b.length;
  const runs = MAX_INSERT_RUN + 1;

  // reach[i * (m+1) * runs + j * runs + r]
  const reach = new Uint8Array((n + 1) * (m + 1) * runs);
  const idx = (i: number, j: number, r: number) => (i * (m + 1) + j) * runs + r;

  reach[idx(0, 0, 0)] = 1;

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      for (let r = 0; r < runs; r++) {
        if (!reach[idx(i, j, r)]) continue;

        // 一致：入力の文字がそのまま出力にある
        if (i < n && j < m && a[i] === b[j]) reach[idx(i + 1, j + 1, 0)] = 1;

        // 削除：入力側の記号・空白だけは落としてよい
        if (i < n && isDeletable(a[i])) reach[idx(i + 1, j, r)] = 1;

        // 挿入：出力側の記号（**空白は足せない**。連続数はリセット）
        if (j < m && isInsertable(b[j])) reach[idx(i, j + 1, 0)] = 1;

        // 挿入：出力側のひらがな（連続 MAX_INSERT_RUN 文字まで）
        if (j < m && isHiragana(b[j]) && r + 1 <= MAX_INSERT_RUN) reach[idx(i, j + 1, r + 1)] = 1;
      }
    }
  }

  for (let r = 0; r < runs; r++) if (reach[idx(n, m, r)]) return true;
  return false;
}

/** 記号と空白を落とす */
function core(text: string): string {
  return Array.from(text).filter((ch) => !isPunct(ch)).join("");
}

/** 記号・空白・ひらがなを落として、内容語の骨格（漢字・カタカナ・数字）だけにする */
function skeleton(text: string): string {
  return Array.from(text).filter((ch) => !isPunct(ch) && !isHiragana(ch)).join("");
}

/**
 * 検査4：内容語の骨格の2-gram包含（アラインの補助判定）。
 *
 * ひらがなを落とした「漢字・カタカナ・数字だけの並び」を取り、その2-gramがすべて
 * 本人の本文にも現れていることを確かめる。**内容語の入れ替え・でっち上げ**を、
 * 辞書なしで捕まえるための検査。
 *
 * ⚠ ひらがなを落とすのが要。落とさずにやると「パンケーキ**が**ふわふわ」の「キが」のように、
 *   **正しく挿入された助詞をまたぐ2-gram**が入力に無いという理由で、正常な整形まで捨ててしまう
 *   （2026-09-13、scripts/polish-guard-fixtures.mjs が実際に捕まえた）。
 */
export function ngramsContained(input: string, output: string): boolean {
  const source = skeleton(input);
  const target = skeleton(output);
  if (target.length < 2) return true;

  for (let i = 0; i + 2 <= target.length; i++) {
    if (!source.includes(target.slice(i, i + 2))) return false;
  }
  return true;
}

/**
 * 検査4b：敬体化の禁止。
 *
 * ⚠ **仕様（docs/specs/survey-v4.md §6-4）の「挿入は連続2文字以内なので『です』『ました』は
 *   構造的に通らない」は誤りだった。** 「です」は**2文字**なので連続2文字の制限を素通りし、
 *   「ました」も入力の「た」と一致させれば「ま」「し」の2文字挿入で作れてしまう
 *   （2026-09-13、必須テストが捕まえた）。
 *
 * 語尾を「です・ます」に揃えると、AIを通した文は100件すべてが同じ終わり方になる。
 * これは Höhne et al. 2024 の「言い直しやフィラーが残ると長さとリズムにばらつきが出て、
 * それが人間らしさになる」を正面から潰す行為で、かつ**公開文の文体を GOOD REVIEW が
 * 決めた証跡**として残る（景表法運用基準 第2・1(2)イ／第2・2(1)オ）。
 *
 * そこで、**入力に無い敬体の語尾が出力に現れたら捨てる**という直接の検査を置く。
 */
const POLITE_ENDINGS = ["です", "ます", "ました", "でした", "ません", "ましょう", "でしょう", "ございま"];

export function politenessOk(input: string, output: string): boolean {
  return POLITE_ENDINGS.every((ending) => !output.includes(ending) || input.includes(ending));
}

/** 検査6：形と長さ。句点は1つまで。出力は入力の 1.4 倍まで */
export function shapeOk(input: string, output: string): boolean {
  const periods = (output.match(/。/g) ?? []).length;
  if (periods > 1) return false;
  if (/[\r\n]/.test(output)) return false;
  return Array.from(output).length <= Math.ceil(Array.from(input).length * MAX_OUTPUT_RATIO);
}

/** 検査5：禁止語とメタ発言。入力に無いのに出てきたら捨てる */
export function wordsOk(input: string, output: string, words: GuardWords): GuardFailure | null {
  for (const pattern of words.meta) {
    if (output.includes(pattern) && !input.includes(pattern)) return "meta";
  }
  for (const word of words.banned) {
    if (output.includes(word) && !input.includes(word)) return "banned";
  }
  return null;
}

/** 文字3-gram の集合 */
function trigrams(text: string): Set<string> {
  const source = core(text);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= source.length; i++) out.add(source.slice(i, i + 3));
  return out;
}

/**
 * 検査7：似すぎ検出。2つの文章の文字3-gramの重なり（Dice係数）を返す。
 * 1.0 が完全一致、0 が全く重ならない。
 */
export function similarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  ga.forEach((gram) => {
    if (gb.has(gram)) shared++;
  });
  return (2 * shared) / (ga.size + gb.size);
}

/** 直近の本文のどれかと似すぎていないか */
export function tooSimilar(output: string, recent: string[]): boolean {
  return recent.some((text) => similarity(output, text) >= SIMILARITY_THRESHOLD);
}

/**
 * 検査1〜7を順に通す。1つでも落ちたら候補を捨てる。
 *
 * @param words  禁止語の一覧（`lib/demo/fact-model.ts` の `GUARD_WORDS` を渡す）
 * @param recent 同一店舗の直近の本文（似すぎ検出用）。無ければ空配列
 */
export function guardPolished(
  input: string,
  output: string,
  words: GuardWords,
  recent: string[] = []
): GuardResult {
  const trimmed = output.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (Array.from(input).length > MAX_INPUT_CHARS) return { ok: false, reason: "too-long-input" };
  if (!shapeOk(input, trimmed)) return { ok: false, reason: "shape" };

  const wordFailure = wordsOk(input, trimmed, words);
  if (wordFailure) return { ok: false, reason: wordFailure };

  if (!politenessOk(input, trimmed)) return { ok: false, reason: "politeness" };
  if (!isDerivable(input, trimmed)) return { ok: false, reason: "not-derivable" };
  if (!ngramsContained(input, trimmed)) return { ok: false, reason: "ngram" };
  if (tooSimilar(trimmed, recent)) return { ok: false, reason: "too-similar" };

  return { ok: true, text: trimmed };
}
