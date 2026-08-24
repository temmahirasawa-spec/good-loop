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
 * 価格IDの形をここで確かめる（2026-08-24 追加）。
 *
 * **実際に商品ID（`prod_...`）が入っていて決済が開けない事故が起きた。**
 * Stripe の商品ページには商品IDと価格IDの両方が出ていて、紛らわしい。
 * 形が違えば「設定されていない」とみなし、押しても失敗するボタンを画面に出さない。
 *
 * `price_` で始まらない値が入っていたときは、原因が分かるようにサーバーログへ残す。
 * これが無いと、画面には「お支払いの画面を開けませんでした」としか出ず、
 * 設定の取り違えなのか通信の失敗なのかを切り分けられない。
 */
function isPriceId(value: string, name: string): boolean {
  if (!value) return false;
  if (value.startsWith("price_")) return true;
  console.error(
    `[billing] ${name} が価格IDではありません（値の先頭: ${value.slice(0, 5)}…）。` +
      `Stripe の商品ページで「価格ID」（price_ で始まる）を控えてください。` +
      `商品ID（prod_ で始まる）では決済を開けません。`,
  );
  return false;
}

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
    isPriceId(STRIPE_PRICE_BASE, "STRIPE_PRICE_BASE") &&
    isPriceId(STRIPE_PRICE_ADDITIONAL_STORE, "STRIPE_PRICE_ADDITIONAL_STORE"),
);
