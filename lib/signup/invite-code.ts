/**
 * 招待コードの形と文言（試験導入＝招待制ベータ。supabase/0018、2026-10-01）。
 *
 * 画面（SignupFlow）とサーバー（/api/signup）の**両方がここだけを見る**。
 * `"use client"` の部品に置かないのは lib/signup/plan.ts と同じ理由
 * （クライアント境界を跨ぐと、サーバー側で値が静かに壊れることがある）。
 *
 * コードは「XXXX-XXXX」。発行は `npm run invite:create`（scripts/create-invite.mjs）で、
 * 紛らわしい 0 O 1 I L を使わない31文字から作る。DB にも同じ形で入っている。
 */

/**
 * 区切りとして読み飛ばす文字（NFKC で半角にそろえたあとに当てる）。
 * 空白（全角を含む）と、ハイフンに見える文字。日本語入力のままハイフンを打つと
 * 長音の「ー」や「−」「‐」「–」「—」になることが多いため、それも区切りとして扱う。
 */
const SEPARATORS = /[\s\-‐-―−ー]/g;

/** 区切りを除いたコードの文字数 */
const CODE_LENGTH = 8;

/**
 * 入力されたコードを、DB に入っている形（XXXX-XXXX）にそろえる。形にならなければ null。
 *
 * 吸収する揺れ：大文字・小文字／全角・半角／ハイフンの有無と種類／空白
 */
export function normalizeInviteCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  const compact = raw.normalize("NFKC").toUpperCase().replace(SEPARATORS, "");
  if (compact.length !== CODE_LENGTH || !/^[A-Z0-9]+$/.test(compact)) return null;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

/**
 * コードが使えないときの文言。
 *
 * **入力の誤り・期限切れ・使用済み・停止中を1つの文言にまとめる。**
 * どれに当たるかを出し分けると、「このコードは存在する（が期限切れ）」と外から探れてしまうため。
 * 画面の形のチェックで落ちたときも、サーバーで落ちたときも同じ文言を出す。
 */
export const INVITE_CODE_UNUSABLE =
  "この招待コードはご利用いただけません。入力に誤りがないか、もう一度お確かめください。それでも進めない場合は、ご案内した担当者にお問い合わせください。";
