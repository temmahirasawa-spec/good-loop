import type { Metadata } from "next";
import { LegalDocument, LegalFooterInfo, LegalLead, LegalNestedList, LegalNotice, LegalOrderedList, LegalSection, LegalTable } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "プライバシーポリシー | GOOD REVIEW",
  description: "GOOD REVIEW（株式会社UTUTU）のプライバシーポリシー",
};

/**
 * プライバシーポリシー（docs/legal/privacy.md 参照。2026-08-06、天真が内容を確認しコード化を承認）。
 *
 * ⚠ 本店所在地の番地・決済代行事業者は未確定のまま〔要確認〕を残している（天真からの回答待ち）。
 * Resend・Stripe・Sentryを導入したら、第4条の委託先一覧に追記すること。実際の公開前に埋めること。
 */
export default function PrivacyPage() {
  return (
    <LegalDocument title="GOOD REVIEW プライバシーポリシー" enactedOn="2026年〇月〇日">
      <LegalLead>
        株式会社UTUTU（以下「当社」といいます。）は、当社が提供するクチコミ獲得・顧客満足度アンケートサービス「GOOD REVIEW」（以下「本サービス」といいます。）における、お客様の個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
        本ポリシーは、本サービスを契約いただく事業者（以下「契約者」といいます。）と、契約者の店舗にご来店され、二次元コードから評価・アンケートにご回答いただく方（以下「利用者」といいます。）の双方に適用されます。
      </LegalLead>

      <LegalSection title="第1条（事業者情報）">
        <p>商号：株式会社UTUTU（英文：UTUTU Inc.）</p>
        <p>本店所在地：兵庫県神戸市〔要確認：番地〕</p>
        <p>代表者：代表取締役 板倉洋輔・平澤天真</p>
        <p>お問い合わせ窓口：info@ututu-design.co.jp</p>
      </LegalSection>

      <LegalSection title="第2条（取得する情報）">
        <p>当社は、本サービスの提供にあたり、以下の情報を取得します。</p>
        <p className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          1. 契約者について
        </p>
        <LegalOrderedList>
          <li>氏名、メールアドレス、パスワード（暗号化して保存します）等のアカウント情報</li>
          <li>店舗名、業態、ロゴ画像等の店舗情報</li>
          <li>Googleマップ上の店舗と紐付けるための情報（店名検索により選択された店舗の情報）</li>
          <li>お支払いに関する情報〔要確認：決済代行事業者を通じて取得する想定です。カード番号そのものは当社サーバーに保存しません〕</li>
        </LegalOrderedList>
        <p className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          2. 利用者（ご来店客）について
        </p>
        <LegalOrderedList>
          <li>評価（5段階）、選択されたタグ・チェック項目</li>
          <li>
            自由記述欄にご入力いただいた内容（お名前やご連絡先など、個人を特定しうる情報が含まれる場合があります。当社は自由記述欄への個人情報の入力を推奨しておらず、記入は任意です）
          </li>
          <li>二次元コードの読み取り日時、Googleのクチコミ投稿画面を開いた／文案をコピーした操作履歴（これらはブラウザに紐付く匿名の行動記録であり、氏名等と直接結びつくものではありません）</li>
          <li>ブラウザのlocalStorageに保存する、同じ端末からの重複回答をやんわり防ぐための識別情報（個人を特定する情報は含みません）</li>
        </LegalOrderedList>
      </LegalSection>

      <LegalSection title="第3条（利用目的）">
        <p>当社は、取得した情報を以下の目的で利用します。</p>
        <LegalOrderedList>
          <li>本サービスの提供、維持、保護及び改善のため</li>
          <li>契約者からのお問い合わせに対応するため</li>
          <li>契約者に本サービスの新機能、更新情報等をお知らせするため</li>
          <li>利用者からいただいた評価・自由記述をもとに、AI（Anthropic社のClaude）を用いてGoogleクチコミの文案を生成するため</li>
          <li>契約者の店舗の顧客満足度・低評価の傾向を分析し、契約者に提供するため</li>
          <li>利用規約に違反する行為への対応のため</li>
          <li>上記の利用目的に付随する目的のため</li>
        </LegalOrderedList>
      </LegalSection>

      <LegalSection title="第4条（第三者への提供・業務委託）">
        <LegalOrderedList>
          <li>
            当社は、あらかじめ利用者又は契約者の同意を得ないで、個人情報を第三者に提供しません。ただし、次に掲げる場合はこの限りではありません。
            <LegalNestedList>
              <li>法令に基づく場合</li>
              <li>人の生命、身体又は財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
            </LegalNestedList>
          </li>
          <li>当社は、本サービスの提供のため、以下の外部事業者に情報の取扱いを委託しています。委託先は、いずれも適切なセキュリティ水準を備えた事業者を選定しています。</li>
        </LegalOrderedList>
        <LegalTable
          headers={["委託先", "委託する内容", "送信する情報"]}
          rows={[
            ["Supabase, Inc.", "データベース・認証基盤（データ保管リージョン：東京）", "本サービスで取得した情報全般"],
            ["Anthropic, PBC", "AIによるクチコミ文案の生成", "評価・タグ・自由記述の内容"],
            ["Google LLC", "店舗のGoogleマップ上の情報検索（Places API）", "契約者が入力した検索キーワード"],
            ["Vercel Inc.", "本サービスのホスティング", "本サービスへのアクセスに伴う通信情報"],
          ]}
        />
        <LegalNotice>〔要確認〕メール送信（Resend）・決済（Stripe）・エラー監視（Sentry）を導入した際は、この表に追記してください。</LegalNotice>
      </LegalSection>

      <LegalSection title="第5条（Cookie等の利用）">
        <p>本サービスは、利用者の重複回答をやんわり防ぐ目的で、ブラウザのlocalStorageを利用します。これは広告配信や第三者へのトラッキングを目的としたものではありません。</p>
      </LegalSection>

      <LegalSection title="第6条（安全管理措置）">
        <p>
          当社は、取得した個人情報の漏えい、滅失又はき損の防止その他の個人情報の安全管理のために必要かつ適切な措置を講じます。具体的には、通信の暗号化、アクセス制御（行レベルセキュリティによるデータの分離）等を実施しています。
        </p>
      </LegalSection>

      <LegalSection title="第7条（保有期間）">
        <p>
          当社は、利用目的の達成に必要な期間、個人情報を保有します。契約者が退会した場合、当該契約者及びその店舗に関連するデータ（利用者の回答データを含みます。）は速やかに削除され、復元できません。
        </p>
      </LegalSection>

      <LegalSection title="第8条（開示、訂正、削除等の請求）">
        <p>
          契約者及び利用者は、当社の保有する自己の個人情報について、法令の定めに基づき、開示、訂正、利用停止、削除等を請求することができます。ご請求は、下記お問い合わせ窓口までご連絡ください。ご本人確認をさせていただいた上で、合理的な期間内に対応します。
        </p>
      </LegalSection>

      <LegalSection title="第9条（未成年者の情報）">
        <p>利用者が未成年である場合、自由記述欄への入力については保護者の方の同意のもとでご利用いただくようお願いいたします。</p>
      </LegalSection>

      <LegalSection title="第10条（本ポリシーの変更）">
        <p>当社は、必要に応じて、本ポリシーを変更することがあります。変更後のプライバシーポリシーは、本サービス上に掲示した時点から効力を生じるものとします。</p>
      </LegalSection>

      <LegalSection title="第11条（お問い合わせ窓口）">
        <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。</p>
        <p>株式会社UTUTU</p>
        <p>E-mail：info@ututu-design.co.jp</p>
      </LegalSection>

      <LegalFooterInfo>
        <p>
          利用規約は
          <a href="/terms" className="underline" style={{ color: "var(--review-accent-primary)" }}>
            こちら
          </a>
          をご覧ください。
        </p>
      </LegalFooterInfo>
    </LegalDocument>
  );
}
