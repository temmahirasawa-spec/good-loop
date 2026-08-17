-- GOOD LOOP: AI視認性チェッカーの費用防御（レート制限とキャッシュ）
--
-- 対応する計画: docs/plans/ai-visibility-checker.md 9-6 / 11章。1機能1ファイル（CLAUDE.md 4章）。
--
-- ⚠ この2つの表は、無料の診断ツールが**認証なしで叩かれる**前提の防御に使う。
--    どちらも特定のテナント（店舗）に属さない。持ち主は株式会社UTUTU。
--
-- ⚠⚠ 権限について（重要）⚠⚠
--    0003_grants.sql の末尾に
--      alter default privileges in schema public grant ... to authenticated, service_role;
--    があるため、**このファイルで作る表にも `authenticated` の権限が自動で付く**。
--    IPアドレスのハッシュを含むので、ログイン中の店舗スタッフからも見えてはいけない。
--    そのため作成直後に anon / authenticated から明示的に剥奪する。
--    RLS も有効にし、**ポリシーを1つも作らない**（＝service_role 以外は1行も見えない）。

-- ── レート制限のための利用記録 ──────────────────────────────
-- tenant-check-allow: 無料診断ツールの利用記録。特定のテナント（店舗）に属さない
create table if not exists ai_check_requests (
  id uuid primary key default gen_random_uuid(),
  -- 生のIPアドレスは保存しない。sha256(IP + AI_CHECK_IP_SALT) だけを持つ
  ip_hash text not null,
  -- キャッシュで返した分は上限に数えない（AIを呼んでいない＝費用が発生していないため）
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);

-- 直近1時間／24時間の絞り込みに使う
create index if not exists ai_check_requests_ip_created_idx
  on ai_check_requests (ip_hash, created_at desc);

-- 全体の1日上限の集計と、古い行の削除に使う
create index if not exists ai_check_requests_created_idx
  on ai_check_requests (created_at desc);

alter table ai_check_requests enable row level security;
revoke all on ai_check_requests from anon, authenticated;
grant select, insert, delete on ai_check_requests to service_role;

-- ── AI応答のキャッシュ ──────────────────────────────────────
-- tenant-check-allow: AI応答のキャッシュ。全利用者で共有し、店舗には属さない
create table if not exists ai_check_cache (
  -- sha256(種別 + 入力 + モデルID + プロンプト版)。モデルやプロンプトを変えると自動で無効になる
  cache_key text primary key,
  -- answer    … 質問 → AIの回答（Web検索込み。費用の大半はここ）
  -- judgement … 回答 × 店名 → 言及判定
  kind text not null check (kind in ('answer', 'judgement')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- 有効期限の判定と、古い行の削除に使う
create index if not exists ai_check_cache_created_idx
  on ai_check_cache (created_at desc);

alter table ai_check_cache enable row level security;
revoke all on ai_check_cache from anon, authenticated;
grant select, insert, update, delete on ai_check_cache to service_role;
