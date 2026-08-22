import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * RLSを迂回するSupabaseクライアント（secret key）。API Route専用。
 *
 * 来店客はログインしない前提（docs/specs/rating-flow.md）のため、01/02/04画面の送信・
 * AI下書き生成のログ保存は、来店客のセッションではなくこのクライアントで書き込む。
 * `SUPABASE_SERVICE_ROLE_KEY` はテナント分離を素通りする鍵なので、
 * Client Componentは元より、意図せずクライアント側バンドルに含まれないよう
 * `server-only` を先頭に置いている（誤ってimportした時点でビルドが落ちる）。
 *
 * 2026-08-18、`cache: "no-store"` を明示した。Next.jsはグローバルの `fetch` を差し替えて
 * 結果をData Cacheに溜めるため、Supabaseへの問い合わせも既定でキャッシュされる。
 * ページ側の `export const dynamic = "force-dynamic"` だけでは防ぎきれず、
 * DBを更新しても画面が古い一覧を出し続ける状態になっていた（詳細は docs/handoff.md）。
 */
export function createSupabaseAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
