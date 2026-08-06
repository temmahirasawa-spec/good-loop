-- GOOD LOOP: ブランドロゴの保存先と、店舗ごとに編集できるアンケート項目の追加
--
-- 対応する仕様: docs/specs/launch-plan.md 決定事項②「アンケートのタグは店舗側が編集できるようにする」。
-- 1機能1ファイル（CLAUDE.md 4章）。2026-08-06、天真の承認を得て着手（CLAUDE.md 3章「DBのスキーマ変更」）。
--
-- store_tags を新設した理由:
--   tags_master（0001）は全店舗共通のプリセット源であり、そのままでは店舗ごとの編集ができない
--   （編集すると他店舗にも影響してしまう）。店舗が自由に追加・削除できる実体として store_tags を
--   別テーブルで持ち、tags_master は「プリセットに戻す」ときの参照元として残す。
--
--   これに伴い、response_tags.tag_id の参照先を tags_master → store_tags に変更する。
--   来店客が実際に選ぶ選択肢は（プリセットのままであっても）店舗の store_tags であり、
--   回答が紐付くべきなのもその実体であるため。現時点で本番の survey_responses は空
--   （フェーズ3〜4の実機確認テストデータは検証後に削除済み、docs/handoff.md参照）なので、
--   既存データへの影響はない。

alter table stores add column if not exists logo_url text;

create table if not exists store_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  label text not null,
  category text not null check (category in ('good', 'improve')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table store_tags enable row level security;

create policy "store_tags: tenant isolation" on store_tags
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create index if not exists store_tags_store_category_idx
  on store_tags (store_id, category, sort_order);

-- 初回アクセス時に tags_master からプリセットを1回だけコピーする処理（lib/store-tags.ts）が
-- 同時アクセスで二重に走っても重複行を作らないようにする
alter table store_tags add constraint store_tags_store_category_label_key
  unique (store_id, category, label);

-- response_tags の参照先を store_tags に切り替える（旧 tags_master 向けの制約を外す）
alter table response_tags drop constraint if exists response_tags_tag_id_fkey;
alter table response_tags add constraint response_tags_tag_id_fkey
  foreign key (tag_id) references store_tags(id) on delete restrict;

-- ブランドロゴ画像の保存先（公開バケット。来店客側画面でロゴを直接表示するため署名URLは使わない）
insert into storage.buckets (id, name, public)
values ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

-- アップロード・更新・削除は、自分のテナントのフォルダ（先頭パスが tenant_id と一致）にのみ許可する。
-- 読み取りはバケットがpublicのため、公開URL経由ならRLSを介さず誰でも取得できる（ロゴは公開情報のため意図通り）。
create policy "store-logos: tenant write" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "store-logos: tenant update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

create policy "store-logos: tenant delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );
