import type { Metadata } from "next";
import { SignupFlow } from "@/components/signup/SignupFlow";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * 新規登録（Figma `11 新規登録 / Signup`。案C = 料金ページ＋申し込みカード）。
 *
 * 商談経由の `npm run tenant:create` は廃止していない。**両方が並走する。**
 * 商談で決まった相手は運営がツールで作り、そうでない相手はこの画面から申し込む。
 *
 * 業態がまだ決まっていない画面なので、色は中立の `Default` モードに寄せる
 * （`data-review-theme` を置かない ＝ `:root` の既定値を使う。docs/handoff.md 参照）。
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

export default function SignupPage() {
  return <SignupFlow />;
}
