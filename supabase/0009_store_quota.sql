-- GOOD LOOP: 店舗枠（契約している店舗数）を tenants に持たせ、枠を超える店舗追加を拒否する
--
-- 背景（2026-08-21、天真の決定）: 店舗の登録には追加課金が必要で、
-- 「お支払いで追加店舗ぶんを済ませてからでないと店舗を追加できない」形にする。
-- 現時点では Stripe が未接続のため、決済そのものは実装せず
--   ① 契約している店舗数（＝枠）を DB に持つ
--   ② 枠が埋まっていたら店舗を追加できない
--   ③ 枠の追加はお支払い画面から申し込む（0011。運営が入金確認後に枠を増やす）
-- の3つだけを作る。Stripe をつないだら、決済成功時に store_quota を増やす処理に差し替える。
--
-- 1機能1ファイル（CLAUDE.md 4章）。既存の列・データは書き換えない（追加のみ）。

alter table tenants add column if not exists store_quota integer not null default 1
  check (store_quota >= 0);

-- 既存テナントは「いま持っている店舗数」を枠とする。
-- こうしないと、この SQL を実行した瞬間に運用中の店舗が枠オーバー扱いになる
-- （既存の店舗が消えるわけではないが、以後1店舗も追加できなくなる）。
update tenants t
set store_quota = greatest(1, (select count(*) from stores s where s.tenant_id = t.id));

-- ── 枠の強制 ────────────────────────────────────────────
-- RLS は「どの行が見えるか」を決める仕組みで、「何行まで作れるか」は表せない。
-- 画面やAPIのチェックだけだと、REST を直接叩かれたときに素通りしてしまうため、
-- 最後の砦として insert 時のトリガーで弾く。
--
-- security definer にしている理由: この関数は tenants を読む必要があるが、
-- 呼び出し元のロール次第では RLS で 0 件に見えることがあり、そのときに
-- 「枠 0 なので常に拒否」という誤判定を起こす。所有者権限で確定的に読ませる。
create or replace function enforce_store_quota() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
  quota integer;
begin
  select count(*) into used from stores where tenant_id = new.tenant_id;
  select store_quota into quota from tenants where id = new.tenant_id;

  if quota is null then
    raise exception 'store quota not found for tenant %', new.tenant_id;
  end if;

  if used >= quota then
    -- このメッセージは API 側（app/api/admin/settings/stores/route.ts）が
    -- 「枠不足」と判定するために見ている。文言を変えるときは両方直すこと
    raise exception 'store quota exceeded';
  end if;

  return new;
end;
$$;

drop trigger if exists stores_enforce_quota on stores;
create trigger stores_enforce_quota
  before insert on stores
  for each row execute function enforce_store_quota();

-- ── 店舗枠を利用者自身に書き換えさせない ──────────────────
-- 0003 で authenticated に tenants の insert / update / delete を与えていた。
-- RLS（0002「tenants: self only」）は「自分の契約者の行」を対象にするポリシーなので、
-- このままだと店舗スタッフが自分の store_quota を好きな数に書き換えられてしまう
-- （REST を直接叩けばよい）。それでは枠の意味が無い。
--
-- アプリのコードは tenants を service_role（退会処理）でしか書き換えていないため、
-- authenticated からは読み取りだけ残して書き込みを外す。
-- これは RLS を緩める変更ではなく、絞る変更（CLAUDE.md 4章）。
revoke insert, update, delete on tenants from authenticated;
