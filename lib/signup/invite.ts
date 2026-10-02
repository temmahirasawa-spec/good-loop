import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 招待コードを使う・戻す（supabase/0018 の関数を呼ぶ。2026-10-01）。
 *
 * **「確かめて使用回数を1つ増やす」は DB の関数の中で、1つの UPDATE として行う。**
 * ここで select してから update すると、残り1回のコードを2人が同時に確かめて、
 * 2人とも登録できてしまう（関数の中の説明を参照）。
 *
 * 関数を実行できるのは service_role だけ（0018 で anon・authenticated から剥奪済み）。
 * 必ず `createSupabaseAdminClient()` のクライアントを渡すこと。
 *
 * ⚠ コードそのものはログに出さない。登録してよいという鍵なので、ログから拾われると使われてしまう。
 */

export type ConsumeInviteResult =
  | { ok: true; inviteCodeId: string }
  /** 使えない（入力の誤り・期限切れ・使用済み・停止中）。どれに当たるかは区別しない */
  | { ok: false; reason: "unusable" }
  /** DB に問い合わせられなかった（0018 が未実行・通信の失敗など） */
  | { ok: false; reason: "unavailable" };

/** コードを1回ぶん使う。`code` は normalizeInviteCode でそろえた形（XXXX-XXXX）を渡す */
export async function consumeInviteCode(admin: SupabaseClient, code: string): Promise<ConsumeInviteResult> {
  const { data, error } = await admin.rpc("consume_invite_code", { p_code: code });
  if (error) {
    console.error("[signup] 招待コードを確かめられなかった", error.message);
    return { ok: false, reason: "unavailable" };
  }
  return typeof data === "string" && data !== "" ? { ok: true, inviteCodeId: data } : { ok: false, reason: "unusable" };
}

/** 登録が途中で失敗したときに、使った1回を戻す（後始末から呼ぶ） */
export async function releaseInviteCode(admin: SupabaseClient, inviteCodeId: string): Promise<void> {
  const { error } = await admin.rpc("release_invite_code", { p_id: inviteCodeId });
  if (error) throw new Error(`招待コードの使用回数を戻せなかった: ${error.message}`);
}
