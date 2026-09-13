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
/**
 * 足してよい助詞の一覧（**許可制**）。
 *
 * ⚠ 2026-09-13、当初は「ひらがななら連続2文字まで何でも」にしていたが、
 *   **それでは意味が反転した**（「よかった」→「よ**くな**かった」は、く・な の2文字挿入で作れる）。
 *   レビューで実際に通ることが再現されたので、**助詞そのものを列挙する形**に変えた。
 *
 * 入れていないもの と その理由:
 *   か … 断定を疑問に変える（「高い」→「高いか」）
 *   な … 禁止になる（「する」→「するな」）
 *   でも・ても … 逆接を足して意味を変える
 *   ね・よ … 語尾に感情を足す
 *   く・い・ない … 否定を作れてしまう
 */
export const PARTICLES = [
  // 2文字を先に置く（長いものから当てるため）
  "から", "まで", "ので", "のに", "のが", "のを", "には", "では", "とは", "にも",
  "での", "への", "との", "だけ", "ほど", "より", "など", "ずつ",
  // 1文字
  "が", "を", "に", "へ", "と", "も", "は", "で", "の", "や",
];
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
 * 足してよい記号。**読点と句点だけ。**
 *
 * ⚠ 2026-09-13 の実測で見つかった穴を2つ塞いである。
 *   ① 空白を許していたため「フレンチトースト **は** しっとり **で** 甘さ ちょうどいい 。」が通った
 *   ② ？！「」… を許していたため、本人が書いていない**意味**を足せた
 *      （「接客よかった」→「接客は、よかった**…**」／「親切だった」→「**「**親切**」**だった」）。
 *      疑問・強調・含みは、書いた本人のものでなければならない。
 */
function isInsertable(ch: string): boolean {
  return ch === "、" || ch === "。";
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
 * 出力が入力から「記号・空白の削除」と「**許可された助詞**・読点・句点の挿入」**だけ**で
 * 作れるかを判定する。両方の走査が前から後ろへしか進まないので、**語順の保存は自動的に保証される**。
 *
 * 状態は (入力のどこまで, 出力のどこまで, 直前に助詞を入れたか)。
 * **助詞を2つ続けて入れることは許さない**（「ははが」のような積み上げを防ぐ）。
 */
export function isDerivable(input: string, output: string): boolean {
  const a = Array.from(input);
  const b = Array.from(output);
  const n = a.length;
  const m = b.length;

  // reach[(i * (m+1) + j) * 2 + justInserted]
  const reach = new Uint8Array((n + 1) * (m + 1) * 2);
  const idx = (i: number, j: number, k: number) => ((i * (m + 1) + j) * 2) + k;

  reach[idx(0, 0, 0)] = 1;

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      for (let k = 0; k < 2; k++) {
        if (!reach[idx(i, j, k)]) continue;

        // 一致：入力の文字がそのまま出力にある
        if (i < n && j < m && a[i] === b[j]) reach[idx(i + 1, j + 1, 0)] = 1;

        // 削除：入力側の記号・空白だけは落としてよい
        if (i < n && isDeletable(a[i])) reach[idx(i + 1, j, k)] = 1;

        // 挿入：読点・句点（**空白も ？！「」… も足せない**）
        if (j < m && isInsertable(b[j])) reach[idx(i, j + 1, 0)] = 1;

        // 挿入：許可された助詞。直前に助詞を入れていたら続けて入れられない
        if (k === 0) {
          for (let t = 0; t < PARTICLES.length; t++) {
            const particle = PARTICLES[t];
            const len = particle.length;
            if (j + len > m) continue;
            if (b.slice(j, j + len).join("") !== particle) continue;
            reach[idx(i, j + len, 1)] = 1;
          }
        }
      }
    }
  }

  return reach[idx(n, m, 0)] === 1 || reach[idx(n, m, 1)] === 1;
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
  // ⚠ 2026-09-13 の訂正：以前は「入力に1つでもあれば出力に何個あってもよい」になっていた。
  //   「常連です 今日も早かった」→「常連です、今日も早かった**です**」が通ってしまった（レビューで再現）。
  //   **回数で比べる**。
  const count = (text: string, needle: string) => text.split(needle).length - 1;
  return POLITE_ENDINGS.every((ending) => count(output, ending) <= count(input, ending));
}

/**
 * 検査6：形と長さ。**1文であること**と、出力が入力の 1.4 倍までであること。
 *
 * ⚠ 2026-09-13 の訂正：以前は「。」だけを数えていたため、
 *   「料理が早い**！**接客もよかった**！**店もきれい**！**」のように
 *   **！や？で何文でも作れて**しまっていた（レビューで再現）。
 *   文の終わりになる記号をまとめて数え、**入力に元からある数を超えさせない**。
 */
export function shapeOk(input: string, output: string): boolean {
  const count = (text: string) => (text.match(/[。！？!?]/g) ?? []).length;
  if (count(output) > Math.max(1, count(input))) return false;
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
