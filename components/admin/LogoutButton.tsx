"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** サイドバー・SPドロワー・設定（アカウント）で共通の「ログアウト」テキストボタン */
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
