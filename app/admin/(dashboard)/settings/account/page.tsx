import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsAccountView } from "@/components/admin/SettingsAccountView";

/** 設定（アカウント） Figma node 73:1434 PC / 75:1917 SP */
export default async function SettingsAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <SettingsAccountView initialEmail={user?.email ?? ""} />;
}
