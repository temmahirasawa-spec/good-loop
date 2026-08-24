-- GOOD REVIEW: 新規登録（セルフサーブ）と無料トライアル
--
-- 背景（2026-08-24、天真の決定。docs/specs/billing.md 5-2）:
-- LPから誰でも申し込めるようにする。**14日間の無料トライアル**で始まり、
-- カードの登録はトライアル開始時に求めない。
--
-- ⚠ **列の追加とテーブルの新設のみ。既存の列・データは1つも書き換えない。**
--    実行しなければ新規登録の導線が動かないだけで、いまの運用には一切影響しない。
--
-- 1機能1ファイル（CLAUDE.md 4章）。

-- ── ① 無料期間の終わり ──────────────────────────────────
-- **`billing_status` は増やさない**（'trial' を足すと check 制約の作り替えが要る）。
-- 「トライアル中か」は次の組み合わせで決まる。状態を2箇所に持つと必ず食い違うため、
-- 判定はコード側の1箇所（lib/billing/trial.ts）に集約する。
--
--   trial_ends_at が未来           → トライアル中
--   trial_ends_at が過去 かつ 契約なし → 期限切れ（停止）
--   stripe_subscription_id がある    → 契約済み（trial_ends_at は無視してよい）
--
-- 既存の契約先（夙川店・検証用テナント）は null のまま＝トライアルの概念の外にいる。
alter table tenants add column if not exists trial_ends_at timestamptz;

comment on column tenants.trial_ends_at is
  '無料トライアルの終わり。null は「トライアル経由で作られていない契約先」（運営が手で作った先）';

-- 期限切れの契約先を運営がまとめて確認するため
create index if not exists tenants_trial_ends_at_idx
  on tenants (trial_ends_at) where trial_ends_at is not null;

-- ⚠ 利用者からは書き換えられない。0009 の
--   revoke insert, update, delete on tenants from authenticated
-- がそのまま効く。**戻さないこと。** 戻すと自分で無料期間を延ばせてしまう。
revoke insert, update, delete on tenants from authenticated;

-- ── ② 新規登録のレート制限 ──────────────────────────────
-- tenant-check-allow: 新規登録の試行記録。契約先が作られる「前」の記録なので、特定の店舗に属さない
--
-- 新規登録は**認証なしで誰でも叩ける**。歯止めが無いと、大量の契約先が作られ、
-- そのぶんトライアルのAIクチコミ生成（Anthropic への課金）が弊社負担で走る。
-- ai_check_requests（0008）と同じ考え方で、生のIPは保存せずハッシュだけを持つ。
create table if not exists signup_attempts (
  id uuid primary key default gen_random_uuid(),
  -- 生のIPアドレスは保存しない。sha256(IP + AI_CHECK_IP_SALT) だけを持つ
  ip_hash text not null,
  -- 成否を分けて数える。失敗（重複メール等）ばかり続く相手は総当たりの可能性がある
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_lookup_idx
  on signup_attempts (ip_hash, created_at desc);

-- ⚠⚠ 権限（0008 と同じ理由）⚠⚠
-- 0003 の `alter default privileges` により、この表にも authenticated の権限が自動で付く。
-- IPアドレスのハッシュを含むので、ログイン中の店舗スタッフからも見えてはいけない。
-- 明示的に剥奪し、RLS を有効にして**ポリシーを1つも作らない**
-- （＝service_role 以外は1行も読めない・書けない）。
revoke all on signup_attempts from anon, authenticated;
alter table signup_attempts enable row level security;
