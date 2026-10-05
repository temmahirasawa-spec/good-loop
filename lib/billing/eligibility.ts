import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIAL_CLAIM_SALT } from "@/lib/billing/config";

/**
 * 2回目の無料体験の判定（docs/specs/billing.md §3-4。Q3・Q4）。
 *
 * **3つのどれかが前に無料体験をしていたら、体験なしで始める**（初日から有料）。
 *
 * | 見るもの | いつ |
 * |---|---|
 * | メールアドレス | カードを入れる前 |
 * | お店（Google マップのお店のID） | カードを入れる前。体験中に紐付けたときも |
 * | カード（Stripe のカードの指紋） | カードを入れた直後 |
 *
 * 記録（supabase/0017 の trial_claims）は**どの契約先にも属さない**。退会でアカウントを消しても残す
 * （残さないと、退会して入り直すだけで2回目が使える）。元の値は持たず、塩と混ぜたハッシュだけを持つ。
 *
 * ⚠ **黙って請求しない。** 外れたときは理由と今日の金額を見せ、「有料で始める」を押したときだけ請求する。
 *   この関数は判定するだけで、請求はしない。
 */

export type ClaimKind = "card" | "email" | "place";

export type ClaimInput = {
  email?: string | null;
  placeIds?: (string | null | undefined)[];
  cardFingerprint?: string | null;
};

/** 外れた理由。画面の「このお店（このカード／このメールアドレス）では…」の出し分けに使う */
export type PriorTrial = { kind: ClaimKind };

function normalize(kind: ClaimKind, value: string): string {
  const v = value.trim();
  // メールは大文字小文字を区別しない（同じ人が Taro@ と taro@ で入り直せないように）
  return kind === "email" ? v.toLowerCase() : v;
}

export function hashClaim(kind: ClaimKind, value: string): string {
  return createHash("sha256").update(`${TRIAL_CLAIM_SALT}:${kind}:${normalize(kind, value)}`).digest("hex");
}

function toPairs(input: ClaimInput): { kind: ClaimKind; value_hash: string }[] {
  const pairs: { kind: ClaimKind; value_hash: string }[] = [];
  if (input.email?.trim()) pairs.push({ kind: "email", value_hash: hashClaim("email", input.email) });
  for (const p of input.placeIds ?? []) if (p?.trim()) pairs.push({ kind: "place", value_hash: hashClaim("place", p) });
  if (input.cardFingerprint?.trim()) pairs.push({ kind: "card", value_hash: hashClaim("card", input.cardFingerprint) });
  return pairs;
}

/** 判定で「どれに引っかかったか」を1つに決める順番。画面に出す理由は1つにする */
const PRIORITY: ClaimKind[] = ["place", "card", "email"];

/**
 * 記録の出どころ（trial_claims.source）。`Stripe の顧客ID:カード登録のID` の形。
 * 個人を指す値ではない（どの登録で書いた記録かを見分けるためだけに持つ）。
 */
export function claimSource(customerId: string, setupIntentId: string): string {
  return `${customerId}:${setupIntentId}`;
}

/** 自分自身の記録を数えないための指定 */
export type IgnoreOwn =
  /** 同じカード登録（Webhook と戻り先の画面が同時に来たとき、1回目が書いた記録で2回目を誤判定しない） */
  | { setupIntentId: string }
  /** 同じ顧客（体験中に、自分の体験で記録したお店を紐付け直したとき） */
  | { customerId: string };

function isOwn(source: string | null, ignore?: IgnoreOwn): boolean {
  if (!ignore || !source) return false;
  return "setupIntentId" in ignore ? source.endsWith(`:${ignore.setupIntentId}`) : source.startsWith(`${ignore.customerId}:`);
}

/** 前に無料体験をしたものがあるか。無ければ null */
export async function findPriorTrial(
  admin: SupabaseClient,
  input: ClaimInput,
  ignore?: IgnoreOwn,
): Promise<PriorTrial | null> {
  const pairs = toPairs(input);
  if (pairs.length === 0) return null;

  const { data, error } = await admin
    .from("trial_claims")
    .select("kind, value_hash, source")
    .in("value_hash", pairs.map((p) => p.value_hash));
  // 読めなかったときに「体験あり」に倒すと、2回目を素通りさせる。**止める側に倒して、呼び出し側でエラーにする**
  if (error) throw new Error(`trial_claims の読み取りに失敗: ${error.message}`);

  const hits = (data ?? []).filter(
    (row: { kind: string; value_hash: string; source: string | null }) =>
      pairs.some((p) => p.kind === row.kind && p.value_hash === row.value_hash) && !isOwn(row.source, ignore),
  );
  if (hits.length === 0) return null;
  const kinds = new Set(hits.map((h: { kind: string }) => h.kind));
  return { kind: PRIORITY.find((k) => kinds.has(k)) ?? "email" };
}

/**
 * 無料体験を使ったことを記録する（体験を始めたときだけ呼ぶ。有料で始めたときは呼ばない）。
 * 同じものがすでにあれば何もしない（上書きしない。最初に使った記録を残す）。
 */
export async function recordTrialClaims(admin: SupabaseClient, input: ClaimInput, source: string): Promise<void> {
  const rows = toPairs(input).map((p) => ({ ...p, source }));
  if (rows.length === 0) return;
  const { error } = await admin.from("trial_claims").upsert(rows, { onConflict: "kind,value_hash", ignoreDuplicates: true });
  if (error) throw new Error(`trial_claims の記録に失敗: ${error.message}`);
}
