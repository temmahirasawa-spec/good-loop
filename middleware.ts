import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase Authのセッションをリクエストごとにリフレッシュする（Supabase公式のSSRパターン）。
 * あわせて `/admin` 配下（ログイン画面自身を除く）を未ログイン時 `/admin/login` へリダイレクトする。
 *
 * Server Componentからはcookieの書き込みができない（lib/supabase/server.ts参照）ため、
 * セッションの更新（refresh tokenのローテーション）はここでしか行えない。
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // reset-password/confirm はメールのリンクから来た「パスワード再設定用の一時セッション」を
  // 使う画面のため、ログイン中と同じ扱いで弾いてはいけない（下の「ログイン中は/adminへ」からも除外する）
  const isPublicAuthRoute = pathname === "/admin/login" || pathname === "/admin/reset-password" || pathname === "/admin/reset-password/confirm";
  const isRedirectIfLoggedInRoute = pathname === "/admin/login" || pathname === "/admin/reset-password";

  if (pathname.startsWith("/admin") && !isPublicAuthRoute && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isRedirectIfLoggedInRoute && user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
