import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllTagPresets } from "@/lib/store-tags";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { CardGateProvider } from "@/components/admin/billing/CardGate";
import { getBillingState } from "@/lib/billing/state";
import { getStoreQuotaState } from "@/lib/admin/store-quota";

// 店舗の有無で行き先が変わるため、毎リクエスト判定する
export const dynamic = "force-dynamic";

/**
 * オンボーディング（Figma `08 オンボーディング / Onboarding`、docs/specs/onboarding.md）。
 *
 * 新規登録（/signup）は店舗を作らない。初回ログイン後にここへ誘導され、
 * 8ステップで「店頭に置く二次元コード」まで作る（所要3分）。
 *
 * `(dashboard)` グループの外に置いている（ログイン画面と同じ扱い）。
 * サイドバーの無い1枚画面のため。認証は middleware.ts が守っている。
 *
 * **店舗が既にあれば管理画面へ返す。** オンボーディングは「最初の店舗を作る」流れなので、
 * 作り終わった人が再訪しても意味がない（2店舗目は設定＞店舗管理から）。
 */
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("stores").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/admin");

  // ステップ4（アンケート項目の確認）で使う。業態を選び直すたびに
  // サーバーへ問い合わせないよう、9業態ぶんを最初に渡す（設定画面と同じ判断）
  const presets = await getAllTagPresets(supabase);
  // ステップ7：申し込みから来た契約先は、二次元コードの前にカードの関門を出す（無料体験 A案。docs/specs/billing.md §3-2）
  const [billing, quota] = await Promise.all([getBillingState(), getStoreQuotaState()]);

  return (
    <CardGateProvider needsCard={billing.access.needsCard} paused={billing.access.paused} quota={quota.quota ?? 1}>
      <OnboardingFlow presets={presets} quota={quota.quota ?? 1} />
    </CardGateProvider>
  );
}
