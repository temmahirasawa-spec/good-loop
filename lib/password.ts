/**
 * パスワードの決まりごと（2026-08-24、天真の決定）。
 *
 * **8文字以上・英字と数字を両方ふくめる。**
 * 「8文字以上」だけだと、数字だけ・同じ文字の繰り返しのような弱いパスワードが通ってしまう。
 * 記号まで必須にすると入力の負担が大きいので、そこは求めない。
 *
 * ⚠ **チェックする場所を増やすときは必ずここを呼ぶ。** 画面ごとに条件を書くと、
 * 「登録では通ったのに変更では弾かれる」という食い違いが起きる。
 * 文言も1箇所に集約してあるので、画面ごとに違う言い回しにならない。
 *
 * サーバー側・クライアント側の両方から使える（`server-only` を付けていない）。
 */

/** 画面に出す決まりごとの説明。入力欄の補足として出す */
// secret-scan-allow: 秘密ではなく画面に表示する説明文。変数名に PASSWORD が入るため誤検知する
export const PASSWORD_RULE_TEXT = "8文字以上。英字と数字を両方ふくめてください";

/** 入力欄のプレースホルダ */
// secret-scan-allow: 同上。実際のパスワードではなく、入力欄に薄く出す例示の文言
export const PASSWORD_PLACEHOLDER = "英字と数字を混ぜて8文字以上";

export const PASSWORD_MIN_LENGTH = 8;

/**
 * 決まりごとを満たしているか調べる。
 * 満たしていれば `null`、満たしていなければ**そのまま画面に出せる文言**を返す。
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`;
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return "英字と数字を両方ふくめてください";
  }
  return null;
}
