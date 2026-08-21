-- GOOD LOOP: アンケート項目のプリセットを業態別にする
--
-- 背景（2026-08-21、天真の承認済み）: tags_master は全店舗共通の1組しか持っておらず、
-- 中身は飲食店の語彙（料理・味／提供スピード…）だけだった。クリニックや整骨院で
-- 新規店舗を作ると、飲食店の項目が初期値として入ってしまう（launch-plan.md 4-B）。
--
-- business_category 列を足し、9業態ぶんのプリセットを持たせる。
-- 店舗の初回アクセス時に、その店舗の業態（stores.business_category、supabase/0007）に
-- 合うプリセットだけを store_tags にコピーする（lib/store-tags.ts）。
--
-- ⚠ この文言は来店客の画面に出る（CLAUDE.md 3章）。2026-08-21、天真の確認済み。
-- ⚠ これは「初期値」であり、店舗側は設定（アンケート項目）でいつでも編集できる。
--   既に運用中の店舗の store_tags には一切影響しない（このファイルは tags_master だけを触る）。
--
-- 1機能1ファイル（CLAUDE.md 4章）。既存11行は削除せず、飲食店のプリセットとして引き継ぐ。

alter table tags_master add column if not exists business_category text
  check (business_category in (
    'clinic', 'restaurant', 'salon', 'beauty', 'seikotsuin',
    'fitness', 'school', 'pet', 'lodging-sauna'
  ));

-- 既存の11行（0001で投入した飲食店の語彙）をそのまま飲食店のプリセットにする
update tags_master set business_category = 'restaurant' where business_category is null;

alter table tags_master alter column business_category set not null;

-- 同じ業態に同じ文言を二重に入れない（この SQL を2回実行しても増えないようにする）
alter table tags_master drop constraint if exists tags_master_category_label_key;
alter table tags_master add constraint tags_master_category_label_key
  unique (business_category, category, label);

insert into tags_master (business_category, category, label, sort_order) values
  -- クリニック
  ('clinic', 'good', '医師の説明', 0),
  ('clinic', 'good', 'スタッフの対応', 1),
  ('clinic', 'good', '院内の清潔感', 2),
  ('clinic', 'good', '待ち時間の短さ', 3),
  ('clinic', 'good', '予約の取りやすさ', 4),
  ('clinic', 'good', '通いやすさ', 5),
  ('clinic', 'improve', '待ち時間', 0),
  ('clinic', 'improve', '医師の説明', 1),
  ('clinic', 'improve', 'スタッフの対応', 2),
  ('clinic', 'improve', '院内の清潔感', 3),
  ('clinic', 'improve', '予約の取りやすさ', 4),

  -- 美容室
  ('salon', 'good', '仕上がり', 0),
  ('salon', 'good', 'スタイリストの提案', 1),
  ('salon', 'good', '接客・スタッフ', 2),
  ('salon', 'good', '店内の雰囲気', 3),
  ('salon', 'good', '清潔感', 4),
  ('salon', 'good', '予約の取りやすさ', 5),
  ('salon', 'improve', '仕上がり', 0),
  ('salon', 'improve', '施術時間', 1),
  ('salon', 'improve', '接客・スタッフの対応', 2),
  ('salon', 'improve', '店内の清潔感', 3),
  ('salon', 'improve', '料金', 4),

  -- エステ・美容
  ('beauty', 'good', '施術の効果', 0),
  ('beauty', 'good', 'カウンセリング', 1),
  ('beauty', 'good', 'スタッフの対応', 2),
  ('beauty', 'good', '店内の雰囲気', 3),
  ('beauty', 'good', '清潔感', 4),
  ('beauty', 'good', '予約の取りやすさ', 5),
  ('beauty', 'improve', '施術の効果', 0),
  ('beauty', 'improve', 'カウンセリング', 1),
  ('beauty', 'improve', 'スタッフの対応', 2),
  ('beauty', 'improve', '店内の清潔感', 3),
  ('beauty', 'improve', '料金', 4),

  -- 整骨院
  ('seikotsuin', 'good', '施術の効果', 0),
  ('seikotsuin', 'good', '説明の分かりやすさ', 1),
  ('seikotsuin', 'good', 'スタッフの対応', 2),
  ('seikotsuin', 'good', '院内の清潔感', 3),
  ('seikotsuin', 'good', '待ち時間の短さ', 4),
  ('seikotsuin', 'good', '通いやすさ', 5),
  ('seikotsuin', 'improve', '施術の効果', 0),
  ('seikotsuin', 'improve', '待ち時間', 1),
  ('seikotsuin', 'improve', '説明の分かりやすさ', 2),
  ('seikotsuin', 'improve', '院内の清潔感', 3),
  ('seikotsuin', 'improve', '料金', 4),

  -- フィットネス
  ('fitness', 'good', 'マシン・設備', 0),
  ('fitness', 'good', 'スタッフの対応', 1),
  ('fitness', 'good', '館内の清潔感', 2),
  ('fitness', 'good', 'レッスンの内容', 3),
  ('fitness', 'good', '通いやすさ', 4),
  ('fitness', 'good', '雰囲気', 5),
  ('fitness', 'improve', '混雑状況', 0),
  ('fitness', 'improve', 'マシン・設備', 1),
  ('fitness', 'improve', '更衣室・シャワーの清潔感', 2),
  ('fitness', 'improve', 'スタッフの対応', 3),
  ('fitness', 'improve', '料金', 4),

  -- スクール
  ('school', 'good', '講師の教え方', 0),
  ('school', 'good', 'カリキュラム', 1),
  ('school', 'good', 'スタッフの対応', 2),
  ('school', 'good', '教室の雰囲気', 3),
  ('school', 'good', '通いやすさ', 4),
  ('school', 'good', '料金の分かりやすさ', 5),
  ('school', 'improve', '講師の教え方', 0),
  ('school', 'improve', 'カリキュラム', 1),
  ('school', 'improve', '教室の設備', 2),
  ('school', 'improve', 'スタッフの対応', 3),
  ('school', 'improve', '料金', 4),

  -- ペット
  ('pet', 'good', 'スタッフの対応', 0),
  ('pet', 'good', '仕上がり', 1),
  ('pet', 'good', 'ペットへの接し方', 2),
  ('pet', 'good', '店内の清潔感', 3),
  ('pet', 'good', '予約の取りやすさ', 4),
  ('pet', 'good', '料金の分かりやすさ', 5),
  ('pet', 'improve', '仕上がり', 0),
  ('pet', 'improve', 'ペットへの接し方', 1),
  ('pet', 'improve', '待ち時間', 2),
  ('pet', 'improve', '店内の清潔感', 3),
  ('pet', 'improve', '料金', 4),

  -- 宿泊・サウナ
  ('lodging-sauna', 'good', '清潔感', 0),
  ('lodging-sauna', 'good', 'スタッフの対応', 1),
  ('lodging-sauna', 'good', '設備・アメニティ', 2),
  ('lodging-sauna', 'good', '施設の雰囲気', 3),
  ('lodging-sauna', 'good', '立地', 4),
  ('lodging-sauna', 'good', 'コスパ', 5),
  ('lodging-sauna', 'improve', '清潔感', 0),
  ('lodging-sauna', 'improve', '設備・アメニティ', 1),
  ('lodging-sauna', 'improve', 'スタッフの対応', 2),
  ('lodging-sauna', 'improve', '混雑状況', 3),
  ('lodging-sauna', 'improve', '料金', 4)
on conflict (business_category, category, label) do nothing;
