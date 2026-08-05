-- GOOD LOOP: 契約主体（tenants）テーブルの新設と、RLSポリシーを本番の認証方式に合わせる
--
-- 背景: 0001 の RLS ポリシーは auth.jwt() ->> 'tenant_id' を参照する暫定形だった
-- （tenant_id をJWTのどこに載せるか未設計だったため）。2026-08-05、天真の決定により
-- 「app_metadata方式」を採用した（docs/handoff.md 参照）。
--
-- app_metadata方式とは:
--   Supabase Auth のユーザーには app_metadata というJSON列があり、これは
--   サービスロールキー（管理者権限）でしか書き換えられない。この中に tenant_id を
--   持たせておけば、Supabase が自動的にJWTへ含めてくれる（Auth Hooksの追加設定は不要）。
--   利用者本人は自分の app_metadata を書き換えられないため、"自分でtenant_idを詐称する"
--   ことができない。運営者が店舗スタッフを招待するとき、Admin APIで
--   app_metadata: { tenant_id: "..." } を設定する運用になる（実装はSupabase接続後）。
--
-- 1機能1ファイルの規約（CLAUDE.md 4章）に従い、0001 は書き換えず本ファイルで追加・変更する。

-- 契約主体（法人・個人事業主）。stores.tenant_id の参照先。
-- tenant-check-allow: このテーブル自身が tenant_id の参照先であり、店舗に属さない
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
  -- 料金体系の金額は8/6のMTG未確定のため、プラン・請求関連の列は入れていない
  -- （2026-08-05 天真決定。決まり次第、別マイグレーションで追加する）
);

alter table tenants enable row level security;

create policy "tenants: self only" on tenants
  for all
  using (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- tenant_id の参照整合性を持たせる。退会時は契約主体の削除に合わせて
-- 配下のデータもすべて削除される（Figma「退会の確認」モーダルの文言と一致させる。
-- store_id 経由の survey_responses 等は既存の on delete cascade でさらに連鎖する）
alter table stores add constraint stores_tenant_id_fkey
  foreign key (tenant_id) references tenants(id) on delete cascade;
alter table survey_responses add constraint survey_responses_tenant_id_fkey
  foreign key (tenant_id) references tenants(id) on delete cascade;
alter table response_tags add constraint response_tags_tenant_id_fkey
  foreign key (tenant_id) references tenants(id) on delete cascade;
alter table ai_draft_logs add constraint ai_draft_logs_tenant_id_fkey
  foreign key (tenant_id) references tenants(id) on delete cascade;

-- RLSポリシーを app_metadata方式に差し替える（0001 の暫定ポリシーを置き換え）
drop policy if exists "stores: tenant isolation" on stores;
create policy "stores: tenant isolation" on stores
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists "survey_responses: tenant isolation" on survey_responses;
create policy "survey_responses: tenant isolation" on survey_responses
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists "response_tags: tenant isolation" on response_tags;
create policy "response_tags: tenant isolation" on response_tags
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

drop policy if exists "ai_draft_logs: tenant isolation" on ai_draft_logs;
create policy "ai_draft_logs: tenant isolation" on ai_draft_logs
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
