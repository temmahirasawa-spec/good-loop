-- GOOD REVIEW: 無料体験を「カードを登録した日から14日間」にする
--
-- 背景（2026-09-28、天真の決定。docs/specs/billing.md §3・§5-2）:
--   - 無料体験は、カードを登録した日から14日間（申し込みの時点では始めない）
--   - 二次元コードの発行・卓上POP・店舗の追加・来店客のアンケートは、カードを登録するまで使えない
--     （「申し込みから来た契約先」だけ。営業経由の契約先は今までどおり）
--   - 2回目の無料体験は無し（カード・メール・お店で判定）
--   - 解約して期間が終わったら「お休み」（見るだけ）。半年使われなければ回答の元データを消す
--
-- ⚠ **列の追加・制約の作り直し・テーブルの新設だけ。既存の行の値は1つも書き換えない。**
--   追加する列の既定値は、いまの振る舞いと同じになる値にしてある（card_required = false）。
--   この SQL を実行しただけでは、いま動いているお店の振る舞いは何も変わらない。
--
-- 1機能1ファイル（CLAUDE.md 4章）。既存の SQL は書き換えない。

-- ── ① 契約先の列 ────────────────────────────────────────

-- 申し込み（/api/signup）から来た契約先の印。カードを登録するまで、アンケートと二次元コードを止める対象。
-- **既定は false。** 営業経由（scripts/create-tenant.mjs）と既存の契約先は false のまま＝止まらない。
alter table tenants add column if not exists card_required boolean not null default false;

-- 解約の予約日（Stripe の cancel_at）。「解約の手続きが済んでいます。○月○日までお使いいただけます」に使う
alter table tenants add column if not exists billing_cancel_at timestamptz;

-- 契約が終わった日時（Stripe の ended_at）。お休みになった日。半年のデータ削除の起点に使う（§3-9）
alter table tenants add column if not exists billing_ended_at timestamptz;

comment on column tenants.card_required is
  '申し込みから来た契約先の印。true かつ契約なしのあいだは、アンケート・二次元コード・店舗の追加を止める（docs/specs/billing.md §3-2）';
comment on column tenants.billing_cancel_at is
  '解約の予約日（Stripe の cancel_at）。予約が取り消されたら null に戻す';
comment on column tenants.billing_ended_at is
  '契約が終わった日時（お休みになった日）。もう一度カードを登録したら null に戻す';

-- ── ② billing_status に 'trialing'（無料体験中）を足す ──────────
-- 0013 で列と一緒に作った check 制約を作り直す。制約の名前は自動で付いているため、
-- 名前を決め打ちにせず「billing_status を見ている check 制約」を探して外す。
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.tenants'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%billing_status%'
  loop
    execute format('alter table public.tenants drop constraint %I', c.conname);
  end loop;
end $$;

alter table tenants add constraint tenants_billing_status_check
  check (billing_status in ('none', 'trialing', 'active', 'past_due', 'canceled'));

-- ⚠ 利用者からは書き換えられない（0009・0013・0014 と同じ）。**戻さないこと。**
--   戻すと、自分で card_required を外したり、billing_status を 'active' に書き換えたりできてしまう。
revoke insert, update, delete on tenants from authenticated;

-- ── ③ 2回目の無料体験の判定の記録 ──────────────────────────
-- tenant-check-allow: 退会でアカウントを消しても残す必要がある判定の記録。特定の契約先に属さない（billing.md §3-4）
create table if not exists trial_claims (
  id uuid primary key default gen_random_uuid(),
  -- card = Stripe のカードの指紋 / email = 小文字にしたメールアドレス / place = Google マップのお店の ID
  kind text not null check (kind in ('card', 'email', 'place')),
  -- 元の値は持たない。sha256(値 + TRIAL_CLAIM_SALT) だけを持つ
  value_hash text not null,
  -- どのカード登録（Stripe の SetupIntent の ID）で記録したか。
  -- 同じカード登録を Webhook と戻り先の画面が同時に処理したとき、自分の書いた記録で
  -- 「2回目の体験」と誤判定しないために使う。個人を指す値ではない
  source text,
  created_at timestamptz not null default now(),
  unique (kind, value_hash)
);

-- 0003 の `alter default privileges` で付く権限を剥がし、RLS を有効にして**ポリシーを作らない**。
-- ＝ service_role（サーバー）以外は1行も読めない・書けない。
-- Supabase は「RLS 有効・ポリシー無し」の表をログイン中に読むと、エラーを出さずに空を返す。この表ではそれが狙いどおり。
revoke all on trial_claims from anon, authenticated;
alter table trial_claims enable row level security;

-- ── ④ お知らせのメールを送った記録 ────────────────────────
-- 7日目・3日前・削除の前のメールを2回送らないため。定期実行も Stripe の通知も、同じ知らせが2回来ることがある
create table if not exists billing_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  -- trial_day7 / trial_will_end / deletion_30d / deletion_7d / data_deleted
  kind text not null,
  -- 同じ種類を別の機会に送るときに分ける値（例: 体験の終わりの日付、削除の予定日）
  ref text not null default '',
  sent_at timestamptz not null default now(),
  unique (tenant_id, kind, ref)
);

revoke all on billing_notices from anon, authenticated;
alter table billing_notices enable row level security;

-- ── ⑤ 解約の理由 ──────────────────────────────────────
-- Stripe の解約画面で選んだ理由（cancellation_details）を受けて記録する。20〜30店たまったら見直す（billing.md §3-7）
create table if not exists cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  stripe_subscription_id text not null,
  -- Stripe の選択肢（too_expensive / missing_features / switched_service / unused / customer_service /
  -- too_complex / low_quality / other）。選ばれなかったら null
  reason text,
  comment text,
  -- 体験中の解約か（有料に進む前にやめたか）
  during_trial boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, stripe_subscription_id)
);

revoke all on cancellation_feedback from anon, authenticated;
alter table cancellation_feedback enable row level security;
