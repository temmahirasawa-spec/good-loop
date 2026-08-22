import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component・Route Handler用のSupabaseクライアント。
 * ログイン中のユーザーのCookieからセッションを読み、RLSがそのユーザーの
 * tenant_id（app_metadata、supabase/0002_tenants_and_rls.sql参照）で効く状態で問い合わせる。
 *
 * Server Componentからは Cookie の書き込みができない（Next.jsの制約）ため、
 * setAll が失敗しても黙って無視している。セッションの更新は middleware.ts 側で行う。
 *
 * 2026-08-18、`cache: "no-store"` を明示した。Next.jsはグローバルの `fetch` を差し替えて
 * 結果をData Cacheに溜めるため、Supabaseへの問い合わせも既定でキャッシュされる。
 * 設定（アンケート項目）画面が古いタグ一覧を表示し、その状態で保存すると
 * 「一覧に無いタグ＝消されたタグ」と判定されて実際に削除される事故につながっていた
 * （保存は差分更新のため。app/api/admin/settings/survey-tags/route.ts 参照）。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
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
