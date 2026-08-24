import "server-only";
import Stripe from "stripe";
import { formatYen } from "@/lib/admin/constants";
import { STRIPE_ENABLED } from "@/lib/billing/config";
import type { BillingCard, BillingInvoice } from "@/lib/billing/types";

/**
 * Stripe クライアントと、画面表示に使う情報の取得（docs/specs/billing.md）。
 *
 * **API バージョンは指定していない。** このSDK（stripe 22.5.0）の既定が
 * `2026-07-29.dahlia` で、天真が Stripe 側の Webhook に設定したバージョンと同じため
 * （2026-08-24 実測）。ここで別の値を書くと、SDKが解釈する形と Stripe が送ってくる形が
 * ずれる可能性がある。SDKを上げるときは Stripe 側の設定と揃っているか確認すること。
 */

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  return client;
}

/** 請求書の「2026年7月」表記。Stripe は UTC の秒で返すので、日本時間に直してから月を取る */
function toPeriodLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
  });
}

export type BillingDisplay = {
  card: BillingCard | null;
  invoices: BillingInvoice[];
  /** Stripe への問い合わせに失敗したか。失敗しても画面は壊さず、その欄だけ断りを出す */
  lookupFailed: boolean;
};

const EMPTY: BillingDisplay = { card: null, invoices: [], lookupFailed: false };

/**
 * お支払い画面に出すカードと請求履歴を Stripe から取ってくる。
 *
 * **DBには保存しない**（同 5章）。保存すると、Stripe側で変更されたときに
 * 古い情報を出し続けて実物と食い違うため。
 *
 * 失敗しても例外を投げない。お支払い画面には店舗枠など他の情報も出ており、
 * Stripe への問い合わせが1回失敗しただけで画面全体を落とすのは割に合わない。
 */
export async function getBillingDisplay(customerId: string | null): Promise<BillingDisplay> {
  if (!STRIPE_ENABLED || !customerId) return EMPTY;

  try {
    const stripe = getStripe();
    const [customer, invoiceList] = await Promise.all([
      stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] }),
      stripe.invoices.list({ customer: customerId, limit: 3 }),
    ]);

    return {
      card: await resolveCard(stripe, customer, customerId),
      invoices: invoiceList.data.map((invoice) => ({
        id: invoice.id ?? `${invoice.created}`,
        periodLabel: toPeriodLabel(invoice.created),
        // JPY は最小単位が「円」そのもの（1円 = 1）。ドルのような100分の1の換算は要らない
        amountLabel: formatYen(invoice.amount_paid || invoice.amount_due),
        receiptUrl: invoice.hosted_invoice_url ?? null,
      })),
      lookupFailed: false,
    };
  } catch {
    return { card: null, invoices: [], lookupFailed: true };
  }
}

/**
 * 表示するカードを決める。
 *
 * まず「請求に使う既定のカード」を見る。Checkout で登録した直後など、まだ既定が
 * 設定されていないことがあるため、そのときは登録済みのカードの先頭を出す
 * （この製品では1契約先につきカードは実質1枚）。
 */
async function resolveCard(
  stripe: Stripe,
  customer: Stripe.Customer | Stripe.DeletedCustomer,
  customerId: string,
): Promise<BillingCard | null> {
  if (!("invoice_settings" in customer)) return null; // 削除済みの顧客

  const preferred = customer.invoice_settings?.default_payment_method;
  if (preferred && typeof preferred !== "string" && preferred.card) {
    return { brand: toBrandLabel(preferred.card.brand), last4: preferred.card.last4 };
  }

  const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  const card = list.data[0]?.card;
  return card ? { brand: toBrandLabel(card.brand), last4: card.last4 } : null;
}

/** Stripe は "visa" のように小文字で返す。画面には「Visa」の形で出す */
function toBrandLabel(brand: string): string {
  const known: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    jcb: "JCB",
    diners: "Diners Club",
    discover: "Discover",
    unionpay: "UnionPay",
  };
  return known[brand] ?? brand.toUpperCase();
}
