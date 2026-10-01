import "server-only";

/**
 * 新規登録の受け付け方（環境変数 SIGNUP_MODE。supabase/0018、2026-10-01）。
 *
 *   invite … 招待コードが必須（試験導入＝招待制ベータの期間）
 *   open   … 招待コードは任意（コードがあれば試験導入、なければ通常の申し込み）
 *
 * **未設定・想定外の値は invite に倒す。** 設定し忘れや綴りの誤り（「opne」など）で
 * 誰でも登録できる状態になるほうが、登録できない状態より害が大きいため。
 *
 * 値はサーバーでだけ読む（画面へは「コードが必須か」だけを渡す）。
 */
export type SignupMode = "invite" | "open";

export function getSignupMode(): SignupMode {
  return process.env.SIGNUP_MODE?.trim().toLowerCase() === "open" ? "open" : "invite";
}
