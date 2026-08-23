import type { Metadata } from "next";
import { AiCheckFlow } from "@/components/ai-check/AiCheckFlow";
import { PUBLIC_APP_URL } from "@/lib/site-url";

/**
 * AI視認性チェッカー（docs/plans/ai-visibility-checker.md）。
 *
 * 「AIに『このエリアのおすすめ』を聞いたとき、自分の店が出てくるか」を実際に計測して、
 * スコアと改善レポートで返す無料の診断ツール。GOOD REVIEW のリード獲得の入口。
 *
 * 色テーマ:
 *   このページは特定の店舗のページではないため、`data-review-theme` を固定値で置く。
 *   `school`（アンバー）を選んだのは、プロトタイプの黄色 #FAC03D に最も近い業態モードだから
 *   （docs/plans/ai-visibility-checker.md 9-3、2026-08-17 天真了承）。
 *   GOOD REVIEW のブランド色が決まったら、この1行を差し替えれば全体の色が変わる。
 *
 * `data-ai-check`:
 *   フォーカスリングの適用範囲（app/globals.css）。管理画面・来店客画面の見た目を
 *   変えずに、このツールだけキーボード操作の視認性を確保するために付けている。
 */

const TITLE = "AI視認性チェッカー | GOOD REVIEW";
const DESCRIPTION =
  "お客様はもう、検索ではなくAIに「このあたりでおすすめのお店は？」と尋ねています。実際にAIへ質問を投げて、あなたのお店が推薦されるかを無料で計測します。株式会社UTUTU の GOOD REVIEW が提供する診断ツールです。";
const PATH = "/ai-check";
const OGP_IMAGE = "/ogp/ai-check.png";

export const metadata: Metadata = {
  // 相対パスのOGP画像を絶対URLに解決するために必要
  metadataBase: new URL(PUBLIC_APP_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "GOOD REVIEW",
  keywords: ["AI視認性", "AIおすすめ", "店舗集客", "Googleクチコミ", "GOOD REVIEW", "飲食店"],
  authors: [{ name: "株式会社UTUTU" }],
  creator: "株式会社UTUTU",
  publisher: "株式会社UTUTU",
  alternates: { canonical: PATH },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "GOOD REVIEW",
    url: PATH,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: OGP_IMAGE,
        width: 1200,
        height: 630,
        alt: "AI視認性チェッカー — あなたのお店、AIに聞くと出てきますか？",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OGP_IMAGE],
  },
};

/**
 * 構造化データ（schema.org）。
 *
 * このツール自体がAIに引用される可能性があるため、「何をするツールで、誰が提供し、
 * 無料で、何を保証しないのか」を機械が読める形で置いておく。
 *
 * ⚠ **事実だけを書くこと。** 実測していない性能や、保証できない効果を書かない。
 *   `disambiguatingDescription` に免責を入れているのは、AIが要約するときに
 *   「掲載を保証するツール」と誤解されないようにするため。
 */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI視認性チェッカー",
  alternateName: "AI Visibility Checker",
  url: `${PUBLIC_APP_URL}${PATH}`,
  description: DESCRIPTION,
  disambiguatingDescription:
    "実際にAIアシスタントへ質問した応答を記録・解析して判定します。特定のAIサービスへの掲載や順位を保証するものではありません。結果は計測時点のスナップショットであり、日時・文脈・モデルの更新によって変動します。",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  browserRequirements: "JavaScript が有効なブラウザ",
  inLanguage: "ja",
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "JPY",
  },
  provider: {
    "@type": "Organization",
    name: "株式会社UTUTU",
    brand: { "@type": "Brand", name: "GOOD REVIEW" },
  },
  featureList: [
    "エリアとジャンルから現実的な質問を組み立て、実際にAIへ投げる",
    "AIの回答に自店が登場するかを表記ゆれを含めて判定する",
    "登場率と順位からAI視認性スコアを算出する",
    "AIが代わりに推薦している他店を集計する",
  ],
};

export default function AiCheckPage() {
  return (
    <div data-review-theme="school" data-ai-check>
      <script
        type="application/ld+json"
        // 自前で組み立てた定数のみを埋め込む（利用者の入力は一切入らない）
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <AiCheckFlow />
    </div>
  );
}
