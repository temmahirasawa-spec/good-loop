import type { Metadata } from "next";
import { LegalDocument, LegalLead } from "@/components/legal/LegalDocument";
import { BILLING, formatYen } from "@/lib/admin/constants";
import { TRIAL_DAYS } from "@/lib/billing/trial";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | GOOD REVIEW",
  description: "GOOD REVIEW（株式会社UTUTU）の特定商取引法に基づく表記",
};

/**
 * 特定商取引法に基づく表記（2026-10-05。9/13 要件定義「入れる」#8 の残り）。
 *
 * 天真の決定（2026-10-05）：
 *   - 未定の項目は空けたままでも先に作る（案1）。所在地は今の栄町（UTUTU の会社サイトと同じ表記）
 *   - 代表者・お問い合わせ窓口は利用規約・プライバシーポリシーの第1条と同じものにそろえる
 *   - 電話番号は「請求があれば遅滞なく開示」（特定商取引法11条ただし書き）
 *
 * 料金は lib/admin/constants.ts の BILLING を参照する（金額を直書きしない。変えるときはここも自動で変わる）。
 * 支払い・解約の決まりは docs/specs/billing.md（§2・§3）と Stripe の設定（期間の終わりに解約）に合わせてある。
 * Stripe の「公開事業情報」にこのページの URL（https://app.good-review.jp/tokushoho）を入れる。
 */
const ROWS: [string, React.ReactNode][] = [
  ["販売事業者", "株式会社UTUTU"],
  ["代表者", "代表取締役 板倉洋輔・平澤天真"],
  ["所在地", "〒650-0023 兵庫県神戸市中央区栄町通1-1-9"],
  ["電話番号", "ご請求があれば遅滞なく開示いたします。お問い合わせはメールでお願いいたします。"],
  ["メールアドレス", "info@ututu-design.co.jp"],
  ["サービスの名称", "GOOD REVIEW（クチコミ獲得・顧客満足度アンケートサービス）"],
  [
    "販売価格",
    <>
      基本料金 月額{formatYen(BILLING.planMonthlyYen)}（税込。{BILLING.includedStores}店舗分を含みます）
      <br />
      2店舗目以降 1店舗につき月額{formatYen(BILLING.additionalStoreMonthlyYen)}（税込）
    </>,
  ],
  [
    "商品代金以外の必要料金",
    "本サービスの利用に必要なインターネット接続の通信料金、および卓上POPを印刷する場合の印刷費用は、お客様のご負担となります。",
  ],
  ["お支払い方法", "クレジットカード"],
  [
    "お支払いの時期",
    <>
      お支払いのカードを登録した日から{TRIAL_DAYS}日間は無料体験期間です。無料体験期間が終わる日に初回の月額料金をご請求し、以降は1か月ごとに自動でご請求します。
      <br />
      有料期間中に店舗枠を増やした場合は、その月の残り日数分の差額をすぐにご請求します。
      <br />
      無料体験は、1つのお店・1枚のカードにつき1回です。以前に無料体験をご利用いただいている場合は、カードを登録した日からご請求が始まります。
    </>,
  ],
  ["サービスの提供時期", "お申し込みの手続きが完了したあと、すぐにご利用いただけます。"],
  [
    "解約について",
    <>
      管理画面の「設定 ＞ お支払い」から、いつでも解約できます。
      <br />
      無料体験期間中に解約した場合、料金はかかりません。無料体験期間の最終日までご利用いただけます。
      <br />
      有料期間中に解約した場合は、その時点のご請求期間の終了日までご利用いただけ、以降のご請求は発生しません。
    </>,
  ],
  ["返金について", "サービスの性質上、お支払いいただいた料金の返金（日割りでの返金を含みます）はいたしかねます。"],
  ["動作環境", "インターネットに接続できるパソコン・スマートフォンの最新のブラウザでご利用いただけます。"],
];

export default function TokushohoPage() {
  return (
    <LegalDocument title="特定商取引法に基づく表記" enactedOn="2026年10月5日">
      <LegalLead>GOOD REVIEW（株式会社UTUTU）の特定商取引法に基づく表記です。</LegalLead>
      <dl className="flex w-full flex-col">
        {ROWS.map(([label, value]) => (
          <div
            key={label}
            className="flex w-full flex-col gap-1 py-4 md:flex-row md:gap-6"
            style={{ borderBottom: "1px solid var(--product-color-border-divider)" }}
          >
            <dt className="shrink-0 text-[13px] font-bold md:w-[176px]" style={{ color: "var(--product-color-text-primary)" }}>
              {label}
            </dt>
            <dd className="min-w-0 text-[13px] leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </LegalDocument>
  );
}
