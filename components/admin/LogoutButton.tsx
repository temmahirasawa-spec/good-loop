"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 「ログアウト」ボタン（設定＞アカウント）。
 *
 * 2026-08-22、天真の決定（docs/ui-review.md Q11）でサイドバー・SPドロワーからは外し、
 * 設定＞アカウントの1箇所に寄せた。同じ操作が2箇所にあると、どちらが正しいか迷わせるため。
 */
export function LogoutButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={className} style={style}>
      ログアウト
    </button>
  );
}
