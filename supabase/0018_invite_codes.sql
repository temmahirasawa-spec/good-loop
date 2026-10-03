-- GOOD REVIEW: 招待コード（試験導入＝招待制ベータ）
--
-- 背景（2026-10-01、天真の決定）:
-- 新規登録（/signup）を「招待コードを持っている人だけ」が使える形にする。
-- 運営が `npm run invite:create` でコードを発行し（scripts/create-invite.mjs）、
-- `https://app.good-review.jp/signup?code=XXXX-XXXX` を本人に渡す。
-- コードで登録した契約先は「試験導入中（無料）」として扱う（tenants.is_pilot）。
--
-- 受け付け方は環境変数 SIGNUP_MODE で切り替える（**未設定なら invite**。lib/signup/mode.ts）:
--   invite … コードが必須（試験導入の期間）
--   open   … コードは任意（コードありで登録すれば試験導入、なしなら通常の申し込み）
--
-- ⚠ **テーブルの新設・列の追加・関数の追加だけ。既存の行の値は1つも書き換えない。**
--   追加する列の既定値（is_pilot = false / invite_code_id = null）は、いまの契約先の状態そのまま。
--   この SQL を実行しただけでは、いま動いているお店の振る舞いは何も変わらない。
--
-- ⚠ **アプリより先に実行すること。** SIGNUP_MODE が invite（未設定を含む）のまま
--   この SQL が無い状態でアプリを出すと、コードを確かめる関数が無いため新規登録がすべて失敗する。
--
-- 1機能1ファイル（CLAUDE.md 4章）。既存の SQL は書き換えない。

-- ── ① 招待コードの台帳 ──────────────────────────────────
-- tenant-check-allow: 招待コードの台帳。契約先が作られる「前」に使うもので、特定の店舗に属さない
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  -- 画面・URL と同じ「XXXX-XXXX」（大文字の英数字4文字＋ハイフン＋4文字）で持つ。
  -- 入力の揺れ（小文字・全角・ハイフンの有無・空白）はアプリ側でこの形にそろえてから照合する
  -- （lib/signup/invite-code.ts）。形の違う値は入れられないようにしておく。
  -- 手で足したコードが小文字やハイフン無しだと、二度と一致しない「使えないコード」になるため
  code text not null unique check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  -- 誰に渡したかのメモ（例：「○○カフェ 山田さん」）
  label text,
  -- 何回まで使えるか（1 = 1つの契約先だけ）
  max_uses integer not null default 1 check (max_uses >= 1),
  -- 使われた回数。増やすのは consume_invite_code（下の③）だけ
  used_count integer not null default 0 check (used_count >= 0),
  -- 使える期限。null なら期限なし
  expires_at timestamptz,
  -- 止めた日時。渡したコードを無効にしたいときは、**行を消さずに**ここを埋める
  -- （使われたコードの行は tenants.invite_code_id から参照されているので消せない）
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

-- ⚠⚠ 権限（0008・0014 と同じ理由）⚠⚠
-- 0003 の `alter default privileges` により、この表にも authenticated の権限が自動で付く。
-- 招待コードはそれ自体が「登録してよい」という鍵なので、ログイン中の店舗スタッフからも、
-- ログインしていない来訪者（anon）からも、1行も見えてはいけない。
-- 明示的に剥奪し、RLS を有効にして**ポリシーを1つも作らない**
-- （＝サーバー（service_role）以外は1行も読めない・書けない）。
revoke all on invite_codes from anon, authenticated;
grant select, insert, update on invite_codes to service_role;
alter table invite_codes enable row level security;

-- ── ② 契約先の列 ────────────────────────────────────────

-- どの招待コードで登録したか。運営が「誰に渡したコードで、どの契約先ができたか」をたどるため
alter table tenants add column if not exists invite_code_id uuid references invite_codes(id);

-- 試験導入中（無料）の印。true のあいだは、管理画面にトライアルの残り日数・お支払いへの誘導を出さない。
-- **既定は false。** 既存の契約先・コードなしの申し込み・営業経由（scripts/create-tenant.mjs）は false のまま。
-- 試験導入を終えるときは、運営がここを false に戻す（その後のお支払いの扱いは別に決める）
alter table tenants add column if not exists is_pilot boolean not null default false;

comment on column tenants.invite_code_id is
  '登録に使った招待コード（supabase/0018）。コードなしで作られた契約先は null';
comment on column tenants.is_pilot is
  '試験導入中（無料）の印（supabase/0018）。true のあいだはトライアルとお支払いの案内を出さない';

-- 「このコードで作られた契約先」を運営が引くため
create index if not exists tenants_invite_code_id_idx
  on tenants (invite_code_id) where invite_code_id is not null;

-- ⚠ 利用者からは書き換えられない（0009・0013・0014 と同じ）。**戻さないこと。**
--   戻すと、店舗スタッフが自分で is_pilot を true にして、お支払いの案内を消せてしまう。
revoke insert, update, delete on tenants from authenticated;

-- ── ③ コードを使う・戻す ────────────────────────────────
-- 「確かめてから使用回数を1つ増やす」を**1つの UPDATE で**行う。
-- 確かめる処理（select）と増やす処理（update）を分けると、残り1回のコードを2人が同時に確かめて
-- 2人とも通ってしまう。1文の UPDATE なら、同じ行を同時に書こうとした2人目は1人目の確定を待ち、
-- そのあとで条件（used_count < max_uses）を確かめ直すので、2人目は弾かれる。
--
-- 使えたらコードの id を、使えなければ null を返す。
-- 期限切れ・使用済み・停止中・存在しない、を**区別しない**（どれに当たるかを外から探らせないため）。
create or replace function public.consume_invite_code(p_code text)
returns uuid
language sql
set search_path = ''
as $$
  update public.invite_codes
     set used_count = used_count + 1
   where code = p_code
     and disabled_at is null
     and (expires_at is null or expires_at > now())
     and used_count < max_uses
  returning id;
$$;

-- 登録が途中で失敗したとき（メールアドレスの重複など）に、使った1回を戻す。0 より下には下げない
create or replace function public.release_invite_code(p_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.invite_codes
     set used_count = used_count - 1
   where id = p_id
     and used_count > 0;
$$;

-- ⚠⚠ 実行できるのはサーバー（service_role）だけ ⚠⚠
-- Postgres は新しい関数を誰でも実行できる状態（PUBLIC）で作り、Supabase はさらに anon・authenticated にも
-- 実行権を付ける。このままだと、ブラウザに渡っている公開キーで `/rest/v1/rpc/consume_invite_code` を叩き、
-- 他人のコードを使い切ったり、コードがあるかどうかを探ったりできてしまう。
revoke all on function public.consume_invite_code(text) from public, anon, authenticated;
revoke all on function public.release_invite_code(uuid) from public, anon, authenticated;
grant execute on function public.consume_invite_code(text) to service_role;
grant execute on function public.release_invite_code(uuid) to service_role;
