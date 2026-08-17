/**
 * 利用者の入力の検査と洗浄。
 *
 * **サーバー側が正。** クライアント側でも同じ上限値を使って入力欄を制限するが、
 * それは親切のためであって、防御は必ずサーバーでやる。
 * このファイルは両方から読むので `server-only` を import しないこと。
 *
 * ⚠ 制御文字・不可視文字の判定は、正規表現ではなく**文字コードの比較**で書いている。
 *   これらの文字を正規表現リテラルに書こうとすると、ソースに実体が埋め込まれて
 *   読めない・grepできない・壊れやすいコードになるため（2026-08-17）。
 */

export const MAX_STORE_NAME_LENGTH = 60;
export const MAX_AREA_LENGTH = 30;
export const MAX_GENRE_LENGTH = 30;
/** 組み立てたあとの質問文の上限 */
export const MAX_QUESTION_LENGTH = 200;

/** これを超える生の入力は、中身を見るまでもなく捨てる */
const HARD_LIMIT = 1000;

const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const DELETE = 127;

/**
 * 制御文字が含まれるか。
 * タブ・改行・復帰は「空白に畳む」対象なので通す。それ以外の制御文字が入っている入力は、
 * 攻撃か壊れたデータなので洗浄せずに弾く。
 */
export function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN) continue;
    if (code < SPACE || code === DELETE) return true;
  }
  return false;
}

/**
 * 目に見えない文字か。
 *   200B-200F  ゼロ幅スペース・ゼロ幅接合子・左右マーク
 *   202A-202E  書字方向の上書き（表示を偽装できる）
 *   2060-2064  ワード接合子・不可視の演算子
 *   FEFF       BOM
 */
function isInvisible(code: number): boolean {
  return (
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    code === 0xfeff
  );
}

/**
 * AIへ渡す文字列から、不可視文字と山括弧を落とす。
 *
 * 山括弧を落とすのは、プロンプトのタグ構造（`<user_query>` など）を
 * 利用者の入力で壊されないようにするため。
 * **利用者の入力だけでなく、AIの回答（Web上の文章由来）にも使う。**
 */
export function stripForPrompt(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (isInvisible(code)) continue;
    if (char === "<" || char === ">") continue;
    out += char;
  }
  return out;
}

/** タブ・改行を半角スペースに畳む。全角スペースは日本語の店名で意味を持つので残す */
function collapseWhitespace(value: string): string {
  return value
    .replace(/[\t\n\r]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export type SanitizeFailure = "not_a_string" | "empty" | "too_long" | "control_chars";

export type SanitizeResult =
  | { ok: true; value: string }
  | { ok: false; reason: SanitizeFailure };

/** 利用者の入力1項目を検査して洗浄する */
export function sanitizeUserText(raw: unknown, maxLength: number): SanitizeResult {
  if (typeof raw !== "string") return { ok: false, reason: "not_a_string" };
  if (raw.length > HARD_LIMIT) return { ok: false, reason: "too_long" };
  if (hasControlChars(raw)) return { ok: false, reason: "control_chars" };

  const value = collapseWhitespace(stripForPrompt(raw));
  if (value === "") return { ok: false, reason: "empty" };
  if (value.length > maxLength) return { ok: false, reason: "too_long" };

  return { ok: true, value };
}
