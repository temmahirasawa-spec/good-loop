import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * お支払いの API が共通で使うもの（docs/specs/billing.md 6章）。
 *
 * `tenants` の課金列は利用者から書き換えられない（supabase/0009 の revoke）。
 * そのため書き込みはすべて service_role のクライアントで行う。
 * **service_role はテナント分離を素通りする鍵なので、必ず tenant_id を指定して書く。**
 */

export type TenantBilling = {
  tenantId: string;
  name: string | null;
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

/** ログイン中のユーザーの契約先を引く。ログインしていない・tenant_id が無ければ null */
export async function getTenantBilling(): Promise<TenantBilling | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || !tenantId) return null;

  const { data } = await supabase
    .from("tenants")
    .select("name, stripe_customer_id, stripe_subscription_id")
    .eq("id", tenantId)
    .maybeSingle<{ name: string | null; stripe_customer_id: string | null; stripe_subscription_id: string | null }>();

  return {
    tenantId,
    name: data?.name ?? null,
    email: user.email ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    stripeSubscriptionId: data?.stripe_subscription_id ?? null,
  };
}

/**
 * Stripe 側の顧客を用意する。すでにあればそれを返し、無ければ作って保存する。
 *
 * `metadata.tenant_id` を必ず入れる。Stripe から届く通知には契約先IDが載っていない
 * ことがあり、そのときに顧客の metadata から引き戻すため。
 */
export async function ensureStripeCustomer(tenant: TenantBilling): Promise<string> {
  if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: tenant.name ?? undefined,
    email: tenant.email ?? undefined,
    metadata: { tenant_id: tenant.tenantId },
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("tenants")
    .update({ stripe_customer_id: customer.id })
    .eq("id", tenant.tenantId);

  // 保存に失敗したら、次に押したときに顧客が二重に作られる。
  // Stripe 側に迷子の顧客が残るより、ここで気づけるほうがよい
  if (error) throw new Error(`Stripe顧客IDの保存に失敗した: ${error.message}`);

  return customer.id;
}

/**
 * 戻り先のURL。Stripe の画面から帰ってくる先に使う。
 *
 * 本番のドメインを決め打ちにすると、ローカルでの動作確認ができない
 * （Stripe から localhost に戻れなくなる）。プロキシ（Vercel）の背後でも正しく取れるよう
 * `x-forwarded-*` を先に見て、取れなければ本番のURLに倒す。
 */
export function appOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return PUBLIC_APP_URL;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
