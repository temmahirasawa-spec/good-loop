-- GOOD LOOP: 卓上POPを名刺サイズ（91×55mm）に作り直す（2026-09-29）
--
-- 背景（天真）:
--   「印刷サイズは、A6だと大きいと思うので名刺サイズがいい」
--   縦・横を選べる／業態に合わせて色とレイアウトを選べる／GOOD REVIEW のロゴはオフにもできる／
--   ブランドとテーマで登録したお店のロゴを使える（オン・オフ）。
--   列を足すこと（向き・デザイン・色・ロゴ2つのオン/オフ）は天真の承認済み（2026-09-29）。
--
-- 画面は Figma App Design Master「13 卓上POP / 名刺サイズ（案3 ステップ）」、
-- 名刺のテンプレートは Components「08 卓上POP / 名刺サイズ」。
--
-- 列を足すだけで、既存のデータは書き換えない。見出し・ひとこと・QRの大きさ（0012）はそのまま引き継ぐ。
-- 0012 の pop_preset（A6 の3デザイン）はもう読まないが、消すと戻せないので残す。
-- stores はテナントの表（tenant_id と RLS は 0001・0002 で設定済み）。RLS は変えない。
-- 1機能1ファイル（CLAUDE.md 4章）。

alter table stores add column if not exists pop_orientation text not null default 'landscape'
  check (pop_orientation in ('landscape', 'portrait'));

alter table stores add column if not exists pop_design text not null default 'simple'
  check (pop_design in ('simple', 'simple_frame', 'illust_bubble', 'illust_phone', 'solid', 'solid_band'));

-- 色は色テーマ（Industry Theme）の9色のどれか。null のときは店舗の色テーマ（loop_theme）を使う
alter table stores add column if not exists pop_color text
  check (pop_color in ('clinic', 'restaurant', 'salon', 'beauty', 'seikotsuin', 'fitness', 'school', 'pet', 'lodging-sauna'));

-- お店のロゴ（stores.logo_url）を載せるか。未登録のときは店名を文字で出す
alter table stores add column if not exists pop_show_store_logo boolean not null default true;

-- GOOD REVIEW のロゴ（いちばん下の中央に小さく）。既定はオン。
-- 「お金を払っているのに広告が出る」と感じる店舗のために、オフにできる
alter table stores add column if not exists pop_show_brand_logo boolean not null default true;
