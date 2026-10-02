import { BILLING } from "@/lib/admin/constants";

/**
 * 申し込みの上限と料金の計算。
 *
 * ⚠ **`"use client"` の部品ではなく、ここに置く。**
 *   2026-08-24、`components/signup/PricingSimulator.tsx`（`"use client"`）に
 *   `MAX_STORES` を置き、それを API Route から import したところ、
 *   **サーバー側では実際の値にならず、上限チェックが素通りした**
 *   （99店舗の申し込みが通ってしまった。実測で確認）。
 *   クライアント境界を跨ぐ定数は、こういう静かな壊れ方をする。
 *
 * 画面とサーバーの**両方がここだけを見る**。二重に持つと必ず食い違う。
 */

/** 申し込める店舗数の上限。これ以上は商談でお願いする */
export const MAX_STORES = 20;

/**
 * 試験導入（招待コードで登録。supabase/0018）で選べる店舗数の上限。
 * **2026-10-01 時点の仮の値（天真さんの判断待ち）。**
 *
 * 試験導入は無料なので、申し込み画面で選んだ店舗数がそのまま**無料の店舗枠**になる。
 * 上限を置かないと、1つのコードで20店舗ぶんの枠が無料で作れてしまう。
 */
export const PILOT_MAX_STORES = 3;

/** 試験導入で上限を超えたときの文言。画面とサーバーで同じものを出す */
export const PILOT_STORE_LIMIT_TEXT = `試験導入では${PILOT_MAX_STORES}店舗までお選びいただけます`;

/** 店舗数から月額を出す */
export function monthlyYenFor(storeCount: number): number {
  const extra = Math.max(0, storeCount - BILLING.includedStores);
  return BILLING.planMonthlyYen + extra * BILLING.additionalStoreMonthlyYen;
}

/** 申し込める店舗数か */
export function isValidStoreCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_STORES;
}
