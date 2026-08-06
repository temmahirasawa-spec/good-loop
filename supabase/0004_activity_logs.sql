-- GOOD LOOP: 送客数・QR読み取り数を実データで出すための行動ログ・アクセスログ
--
-- 対応する仕様: docs/specs/launch-plan.md C節。1機能1ファイル（CLAUDE.md 4章）。
-- 2026-08-06、天真の承認を得て着手（CLAUDE.md 3章「DBのスキーマ変更」）。
--
-- conversion_events（行動ログ）:
--   03画面「①この文章をコピー」「②Googleマップを開く」を押すたびに1行記録する。
--   「Googleへ送客した数」は event_type = 'opened_google' の件数で数える方針
--   （コピーしただけで離脱した場合は送客に含めない）。
-- page_views（アクセスログ）:
--   /r/[storeSlug] が表示されるたびに1行記録する。QR読み取り数の元データ。
--
-- どちらも来店客はログインしないため、書き込みは admin client（service_role）から行う想定。
-- RLSポリシーは管理画面（店舗スタッフ・運営者）からの読み取りだけを対象にしている
-- （0002 で確定した app_metadata方式に最初から合わせてある）。
-- 0003 の `alter default privileges` により、GRANTは新規テーブルにも自動で付く。

create table if not exists conversion_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  survey_response_id uuid not null references survey_responses(id) on delete cascade,
  event_type text not null check (event_type in ('copied_draft', 'opened_google')),
  created_at timestamptz not null default now()
);

alter table conversion_events enable row level security;

create policy "conversion_events: tenant isolation" on conversion_events
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- 管理画面の集計（送客数・送客率）が store_id + event_type + created_at を横断して引く前提
create index if not exists conversion_events_store_event_created_idx
  on conversion_events (store_id, event_type, created_at);

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table page_views enable row level security;

create policy "page_views: tenant isolation" on page_views
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create index if not exists page_views_store_created_idx
  on page_views (store_id, created_at);
