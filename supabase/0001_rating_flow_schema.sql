-- GOOD LOOP: お客様側フロー（評価〜Google誘導）のデータモデル
--
-- 対応する仕様: docs/specs/rating-flow.md（D節）。1機能1ファイル（CLAUDE.md 4章）。
--
-- RLS の方針:
--   - 来店客からの書き込み（02/04画面の送信）は、来店客に Supabase Auth のログインをさせない前提。
--     Next.js の API Route が SUPABASE_SERVICE_ROLE_KEY（RLS を迂回する鍵。.env.local.example 参照）で
--     行う想定なので、ここでの RLS ポリシーは「管理画面からの読み書き（店舗スタッフ・運営者）」だけを
--     対象にしている
--   - 認証まわり（Supabase Auth のトークンに tenant_id をどう載せるか）はまだ実装していないため、
--     ポリシーは auth.jwt() ->> 'tenant_id' を参照する暫定形にしてある。認証の実装が固まったら見直すこと
--   - `tenants`（契約主体）マスタ表はまだ作っていない。料金体系が8/6のMTGで未確定のため、
--     契約単位のテーブル設計はそちらの決定後に回している（docs/handoff.md 参照）

create extension if not exists pgcrypto;

-- tenant-check-allow: 全店舗共通のタグ選択肢マスタ（店舗に属さない）
create table if not exists tags_master (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  category text not null check (category in ('good', 'improve')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  slug text not null unique,
  -- data-loop-theme の値と一致させる（app/design-tokens.css 参照。source of truth は Figma Variables）
  loop_theme text not null check (
    loop_theme in (
      'clinic', 'restaurant', 'salon', 'beauty', 'seikotsuin',
      'fitness', 'school', 'pet', 'lodging-sauna'
    )
  ),
  google_place_id text,
  google_maps_fallback_url text,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;

create policy "stores: tenant isolation" on stores
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- 01画面「回答する」/04画面「送信する」時点で確定する回答本体。
-- ★4以上（branch=good）・★3以下（branch=improve）を1テーブルに統合している
-- （タグの語彙差は tags_master.category で吸収する。理由は rating-flow.md D節参照）
create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null references stores(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  branch text not null check (branch in ('good', 'improve')),
  free_text text,
  created_at timestamptz not null default now()
);

alter table survey_responses enable row level security;

create policy "survey_responses: tenant isolation" on survey_responses
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ダッシュボード集計（KPI・NPS・評価内訳・トレンド）が store_id + created_at + rating を
-- 横断して引く前提（rating-flow.md D節）
create index if not exists survey_responses_store_created_idx
  on survey_responses (store_id, created_at);

-- 回答とタグの中間テーブル（jsonb配列ではなく正規化テーブルを採用。
-- タグ別の集計をSQLで直接 group by できるようにするため）
create table if not exists response_tags (
  tenant_id uuid not null,
  response_id uuid not null references survey_responses(id) on delete cascade,
  tag_id uuid not null references tags_master(id) on delete restrict,
  primary key (response_id, tag_id)
);

alter table response_tags enable row level security;

create policy "response_tags: tenant isolation" on response_tags
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- AI下書き生成（B節・案1）のログ。失敗率・再生成率の可視化に使う想定
create table if not exists ai_draft_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  response_id uuid not null references survey_responses(id) on delete cascade,
  model text not null,
  prompt_version text not null,
  output_text text,
  latency_ms integer,
  success boolean not null,
  fallback_used boolean not null default false,
  regenerate_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table ai_draft_logs enable row level security;

create policy "ai_draft_logs: tenant isolation" on ai_draft_logs
  for all
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
