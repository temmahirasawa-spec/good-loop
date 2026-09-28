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
 * 消費税（10%・外税）の税率ID（2026-09-28、docs/specs/billing.md §2「消費税」）。
 *
 * 価格は「税抜」で登録してあり、**税率を付けないと Stripe は税を0円で計算する**（エラーも出ない）。
 * 2026-09-28 にテスト環境で確かめたところ、実際に消費税が請求に乗っていなかった。
 * 契約を作るときに必ず `default_tax_rates` に付ける。
 */
export const STRIPE_TAX_RATE_ID = process.env.STRIPE_TAX_RATE_ID ?? "";

function isTaxRateId(value: string): boolean {
  if (!value) {
    console.error("[billing] STRIPE_TAX_RATE_ID が未設定です。消費税を請求できないため、課金の導線を止めています。");
    return false;
  }
  if (value.startsWith("txr_")) return true;
  console.error(`[billing] STRIPE_TAX_RATE_ID が税率IDではありません（値の先頭: ${value.slice(0, 4)}…）。txr_ で始まるIDを控えてください。`);
  return false;
}

/**
 * 2回目の無料体験の判定に使う塩（docs/specs/billing.md §3-4）。
 *
 * メール・カードの指紋・お店のIDは、この塩と混ぜたハッシュにしてから保存する（元の値は持たない）。
 * ⚠ **一度決めたら変えないこと。** 変えると過去の記録と照合できなくなり、2回目の体験が素通りする。
 */
export const TRIAL_CLAIM_SALT = process.env.TRIAL_CLAIM_SALT ?? "";

function isSalt(value: string): boolean {
  if (value.length >= 16) return true;
  console.error("[billing] TRIAL_CLAIM_SALT が未設定か短すぎます（16文字以上）。2回目の無料体験を判定できないため、課金の導線を止めています。");
  return false;
}

/**
 * 課金の導線を出してよいか。
 *
 * Webhook の署名シークレットも条件に入れている。これが無いと、決済が済んでも
 * その通知を受け取れず（＝店舗枠が増えず）、お金だけ取って何も起きない状態になる。
 * 「払えるが反映されない」は「まだ払えない」より悪い。
 *
 * 2026-09-28、税率と判定の塩も条件に入れた。税率が無いと消費税を取れず、
 * 塩が無いと2回目の無料体験を防げない。どちらも「始めてから気づく」と取り返しがつかない。
 * **これが false のあいだは、カードの関門も出さない**（§9。申し込みから来た契約先も今までどおり使える）。
 */
export const STRIPE_ENABLED = Boolean(
  process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    isPriceId(STRIPE_PRICE_BASE, "STRIPE_PRICE_BASE") &&
    isPriceId(STRIPE_PRICE_ADDITIONAL_STORE, "STRIPE_PRICE_ADDITIONAL_STORE") &&
    isTaxRateId(STRIPE_TAX_RATE_ID) &&
    isSalt(TRIAL_CLAIM_SALT),
);

/**
 * テストのときだけ、新しく作る Stripe の顧客を Test Clock（日付を進められる時計）に付ける（§14）。
 * 7日目・3日前・15日目をすぐに起こすため。**本番の鍵（sk_live_ / rk_live_）では使わない。**
 */
export function testClockId(): string | undefined {
  const id = process.env.STRIPE_TEST_CLOCK_ID;
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!id || !/^(sk|rk)_test_/.test(key)) return undefined;
  return id;
}
