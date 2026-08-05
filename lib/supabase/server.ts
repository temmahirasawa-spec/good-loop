import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component・Route Handler用のSupabaseクライアント。
 * ログイン中のユーザーのCookieからセッションを読み、RLSがそのユーザーの
 * tenant_id（app_metadata、supabase/0002_tenants_and_rls.sql参照）で効く状態で問い合わせる。
 *
 * Server Componentからは Cookie の書き込みができない（Next.jsの制約）ため、
 * setAll が失敗しても黙って無視している。セッションの更新は実際にログインを
 * 実装するとき、middleware.ts 側で行う（まだ未実装）。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as CookieOptions));
        } catch {
          // Server Component からの呼び出しでは書き込めない。ミドルウェアでのセッション更新に任せる
        }
      },
    },
  });
}
