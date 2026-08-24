import "server-only";

/**
 * Stripe の設定（docs/specs/billing.md 7章）。
 *
 * **鍵が1つでも欠けていたら「未接続」として扱い、課金の導線を画面に出さない。**
 * 中途半端に押せる状態にすると、押した人にはエラーの理由が分からないため。
 * 未接続のあいだ、店舗枠の追加は今までどおりの申し込み（supabase/0011）になる。
 *
 * 値そのものはここでしか読まない。`server-only` を先頭に置いているので、
 * 誤ってクライアント側から import した時点でビルドが落ちる。
 */

/** 基本プラン（1店舗込み）の価格ID。Stripe の商品カタログで作る */
export const STRIPE_PRICE_BASE = process.env.STRIPE_PRICE_BASE ?? "";
/** 追加1店舗ぶんの価格ID */
export const STRIPE_PRICE_ADDITIONAL_STORE = process.env.STRIPE_PRICE_ADDITIONAL_STORE ?? "";

/**
 * 課金の導線を出してよいか。
 *
 * Webhook の署名シークレットも条件に入れている。これが無いと、決済が済んでも
 * その通知を受け取れず（＝店舗枠が増えず）、お金だけ取って何も起きない状態になる。
 * 「払えるが反映されない」は「まだ払えない」より悪い。
 */
export const STRIPE_ENABLED = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    STRIPE_PRICE_BASE &&
    STRIPE_PRICE_ADDITIONAL_STORE,
);
