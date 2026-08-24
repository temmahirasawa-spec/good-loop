-- GOOD REVIEW: 低評価アラートの通知設定（店舗ごと）
--
-- 背景（2026-08-24、天真の決定）: ★3以下の回答が入った瞬間に、店舗へメールで知らせる。
-- Resend の接続が済んだので実装できるようになった（docs/setup-tasks.md 4章）。
--
-- **通知先は店舗ごとに持つ。** 低評価は「その店の問題」なので、店長に直接届いて
-- その場で手を打てるほうがよい。契約先ごとに1つだと、多店舗の契約先で本部に
-- 全店舗ぶんのアラートが集中してしまう。
--
-- ⚠ **列の追加のみ。既存の列・データは1つも書き換えない。**
--    実行しなければ通知が飛ばないだけで、いまの運用には影響しない。
--
-- 1機能1ファイル（CLAUDE.md 4章）。

-- 低評価アラートを送るか（既定は on。低評価に気づけないほうが損失が大きいため）
alter table stores add column if not exists notify_low_rating boolean not null default true;

-- 通知先。null のときは「まだ設定していない」＝送らない。
-- **ログイン用のメールアドレスを勝手に使わない。** 店長と契約者が別人のことがあるため
-- （契約は本部、現場は店長、という多店舗の形）。
alter table stores add column if not exists notify_email text;

comment on column stores.notify_email is
  '低評価アラートの宛先。null なら送らない。ログイン用のメールアドレスとは別物（店長と契約者が別人のことがあるため）';

-- 送る対象の店舗だけを引く。店舗が増えても速度が落ちないように
create index if not exists stores_notify_low_rating_idx
  on stores (id) where notify_low_rating and notify_email is not null;

-- ── 権限 ────────────────────────────────────────────────
-- stores は 0003 で authenticated に update を与えてあり、RLS（0002「stores: tenant isolation」）
-- で自分のテナントの行だけに絞られる。**この2列も同じ扱いでよい**
--   ・通知先を変えられて困るのは本人だけ（他テナントには波及しない）
--   ・店舗の名前や業態と同じく、店舗の設定の一部
-- そのため、ここで新たに GRANT を足したり RLS を緩めたりはしない。
