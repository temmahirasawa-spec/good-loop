-- GOOD LOOP: 業態（business_category）を色テーマ（loop_theme）から分離する
--
-- 背景（2026-08-06、天真の決定）: loop_theme は「色」と「業態」を兼ねていたが、
-- 「飲食店でオレンジ以外の色を選びたい」「宿泊・サウナでピンクを選びたい」という
-- ニーズがあるため分離する。
--
--   - loop_theme：今後は「色」だけを表す。値・意味（9種のスラッグ）は変えない。
--     表示ラベルだけがアプリ側で業態名から色名に変わる（lib/admin/constants.ts）
--   - business_category：新設。業態そのものを表す。将来的にアンケートのタグプリセットを
--     業態別に出し分けるために使う（launch-plan.md 4-B、まだ未実装）
--
-- 既存店舗（夙川店など）は、これまで loop_theme が業態を兼ねていたため、
-- その値をそのまま business_category の初期値として引き継ぐ。

alter table stores add column business_category text
  check (business_category in (
    'clinic', 'restaurant', 'salon', 'beauty', 'seikotsuin',
    'fitness', 'school', 'pet', 'lodging-sauna'
  ));

update stores set business_category = loop_theme where business_category is null;

alter table stores alter column business_category set not null;
