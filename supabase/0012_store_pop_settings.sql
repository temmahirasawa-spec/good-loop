-- GOOD LOOP: 卓上POP（印刷用）の設定を店舗ごとに持つ
--
-- 背景（2026-08-22、天真のFigmaコメント）:
--   「QRはこの3つをプリセットにして、そのプリセットを選んだら内容を自由に編集できるようにしたい。
--     QRのサイズ、文字の内容などです。」
--
-- 卓上POPのデザインは3種（A=QRが主役 / B=ことばが主役 / C=最小限）。
-- 店舗はそのどれかを選び、見出し・ひとこと・QRの大きさを自分で書き換えられる。
-- 印刷は A6（105×148mm）。
--
-- ⚠ このSQLはまだ実行しないこと。天真の承認待ち（CLAUDE.md 3章「DBのスキーマ変更」）。
-- 1機能1ファイル（CLAUDE.md 4章）。列を足すだけで、既存データは書き換えない。

alter table stores add column if not exists pop_preset text not null default 'a'
  check (pop_preset in ('a', 'b', 'c'));

-- 見出し・ひとことは店舗が自由に書き換える。空（null）のときは
-- アプリ側がプリセットごとの既定文言を使う（lib/admin/pop.ts）
alter table stores add column if not exists pop_heading text;
alter table stores add column if not exists pop_note text;

alter table stores add column if not exists pop_qr_size text not null default 'lg'
  check (pop_qr_size in ('sm', 'md', 'lg'));
