-- GOOD REVIEW: Stripe（お支払い）の契約状態を tenants に持たせる
--
-- 背景（2026-08-24、天真の決定。docs/specs/billing.md）:
-- カード番号の入力は Stripe の画面（Checkout / カスタマーポータル）に任せ、
-- GOOD REVIEW 側はカード情報を一切保持しない。ここで持つのは
--   ① Stripe 側の顧客ID・契約ID（＝どの契約先がどの契約に対応するか）
--   ② 契約が正常か（billing_status）
--   ③ 次回の請求日（画面表示用）
-- の3つだけで、カード番号・有効期限・名義は**保存しない**。
--
-- 店舗枠（0009 の tenants.store_quota）の正は Stripe 側になる。
-- 決済された数量が Webhook 経由でこの列に書き戻される（docs/specs/billing.md 3章）。
-- ただし Stripe に繋がっていない契約先（billing_status = 'none'）は、
-- 今までどおり運営が手で store_quota を増やす。検証・デモ・無償提供のため。
--
-- 1機能1ファイル（CLAUDE.md 4章）。**列の追加のみ。既存の列・データは書き換えない。**

-- ── 契約状態の列 ────────────────────────────────────────
alter table tenants add column if not exists stripe_customer_id text;
alter table tenants add column if not exists stripe_subscription_id text;
alter table tenants add column if not exists billing_status text not null default 'none'
  check (billing_status in ('none', 'active', 'past_due', 'canceled'));
alter table tenants add column if not exists billing_current_period_end timestamptz;

-- 1つの Stripe 顧客が2つの契約先に紐づくと、請求先が入れ替わる事故になる。
-- 部分インデックスにしているのは、未接続の契約先（null）が複数あって当然のため
-- （null は一意制約の対象外だが、意図を明示するために where を書いている）。
create unique index if not exists tenants_stripe_customer_id_key
  on tenants (stripe_customer_id) where stripe_customer_id is not null;

-- Webhook は「Stripe の契約ID」から契約先を引く。毎回の全表走査を避ける
create index if not exists tenants_stripe_subscription_id_idx
  on tenants (stripe_subscription_id) where stripe_subscription_id is not null;

-- ── 書き込みは Stripe からの通知だけに限る ──────────────────
-- 0009 で `revoke insert, update, delete on tenants from authenticated` 済みのため、
-- ここで追加した列も利用者からは読み取り専用になっている。
-- この SQL より後に GRANT を足すときに、うっかり書き込み権を戻さないこと。
-- 戻すと、店舗スタッフが自分の billing_status を 'active' に書き換えられる
-- （＝お金を払わずに店舗枠を増やせる）。
--
-- 念のため、この時点でも同じ revoke を明示しておく（0009 を実行済みなら無害な再実行）。
revoke insert, update, delete on tenants from authenticated;

-- ── 既存データの扱い ────────────────────────────────────
-- billing_status の既定は 'none'。既存の契約先（夙川店のテナント含む）はすべて
-- 「カード未登録・運営が手で枠を管理」の状態から始まる。これは現状の運用と同じで、
-- この SQL を実行しても振る舞いは変わらない。
