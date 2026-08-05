import { redirect } from "next/navigation";

/** `/admin/settings` はタブの既定値（ブランドとテーマ）へ寄せる */
export default function AdminSettingsPage() {
  redirect("/admin/settings/brand");
}
