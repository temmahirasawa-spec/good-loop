-- GOOD LOOP: 店舗枠の追加申し込みを記録する
--
-- 背景（2026-08-21、天真の決定）: 店舗の追加には課金が必要（0009）だが、Stripe が
-- まだ未接続なので、お支払い画面の「店舗枠を追加する」は決済ではなく**申し込み**にする。
-- 申し込みはこの表に残り、運営（天真）が入金確認のうえ tenants.store_quota を増やす。
--
-- Stripe をつないだら、この表ごと廃止できる（決済成功時に store_quota を増やす形に変わる）。
-- そのため、この表を参照する処理は「お支払い画面の申し込みボタン」1箇所だけに留めている。
--
-- 1機能1ファイル（CLAUDE.md 4章）。

create table if not exists store_quota_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  -- 申し込み時点の枠と、申し込み後の枠。あとから金額の根拠をたどれるようにする
  current_quota integer not null,
  requested_quota integer not null check (requested_quota >= 1),
  -- 申し込み時点で画面に出していた追加料金（円／月・1店舗あたり）。
  -- 料金は未確定の仮の値（lib/admin/constants.ts の BILLING）なので、
  -- あとで値が変わっても「いくらで申し込まれたか」が残るように保存する
  monthly_yen integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table store_quota_requests enable row level security;

create policy "store_quota_requests: tenant isolation" on store_quota_requests
  for all
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- お支払い画面が「申し込み中のものがあるか」を1件だけ引く
create index if not exists store_quota_requests_tenant_created_idx
  on store_quota_requests (tenant_id, created_at desc);

-- 申し込みの承認（status の書き換え）は運営が Supabase 上で行う。
-- 利用者自身に承認させないため、authenticated からは更新・削除を外す
-- （0003 の alter default privileges で自動的に付いてしまうので、明示的に剥がす）。
revoke update, delete on store_quota_requests from authenticated;
