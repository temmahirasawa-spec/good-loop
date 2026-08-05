import { createBrowserClient } from "@supabase/ssr";

/**
 * ブラウザ（Client Component）用のSupabaseクライアント。
 *
 * 公開しても問題ない鍵（publishable key）だけを使う。RLSはanon/publishableキー
 * でもログイン中のユーザーのセッションを通して効くため、これでテナント分離は保たれる
 * （supabase/0002_tenants_and_rls.sql のapp_metadata方式）。
 *
 * ⚠ 環境変数名は Supabase の現行の呼び方（publishable key）と揃えたいところだが、
 * Vercel・.env.local には旧名 NEXT_PUBLIC_SUPABASE_ANON_KEY で登録済み（2026-08-05）。
 * 値自体は新形式（sb_publishable_...）なのでこのままで動く。改名は任意。
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
