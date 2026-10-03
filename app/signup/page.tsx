import type { Metadata } from "next";
import { SignupFlow } from "@/components/signup/SignupFlow";
import { PUBLIC_APP_URL } from "@/lib/site-url";
import { getSignupMode } from "@/lib/signup/mode";
import { normalizeInviteCode } from "@/lib/signup/invite-code";

/**
 * 新規登録（Figma `11 新規登録 / Signup`。案C = 料金ページ＋申し込みカード）。
 *
 * 商談経由の `npm run tenant:create` は廃止していない。**両方が並走する。**
 * 商談で決まった相手は運営がツールで作り、そうでない相手はこの画面から申し込む。
 *
 * 業態がまだ決まっていない画面なので、色は中立の `Default` モードに寄せる
 * （`data-review-theme` を置かない ＝ `:root` の既定値を使う。docs/handoff.md 参照）。
 *
 * 招待コード（試験導入＝招待制ベータ。supabase/0018、2026-10-01）：
 * `/signup?code=XXXX-XXXX` で開くと、コードの欄に入った状態で始まる。
 * コードが必須かは SIGNUP_MODE で決まる（未設定なら必須。lib/signup/mode.ts）。
 * どちらもリクエストのたびに読むため、このページは毎回サーバーで組み立てる。
 */

const TITLE = "料金とお申し込み | GOOD REVIEW";
const DESCRIPTION =
  "GOOD REVIEW の料金とお申し込み。プランは1つだけ、店舗数で月額が決まります。14日間の無料でお試しいただけます（カードの登録は不要）。株式会社UTUTU";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "GOOD REVIEW",
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "GOOD REVIEW",
    url: "/signup",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SignupPage({ searchParams }: { searchParams: { code?: string | string[] } }) {
  const raw = Array.isArray(searchParams.code) ? searchParams.code[0] : searchParams.code;
  // 揺れ（小文字・ハイフン無し）はここで XXXX-XXXX にそろえて見せる。
  // 形にならない値はそのまま入れておき、進むときに「使えません」と伝える（黙って消さない）
  const initialInviteCode = raw ? (normalizeInviteCode(raw) ?? raw.slice(0, 32)) : "";

  return <SignupFlow inviteRequired={getSignupMode() === "invite"} initialInviteCode={initialInviteCode} />;
}
