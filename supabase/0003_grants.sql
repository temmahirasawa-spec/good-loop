-- GOOD LOOP: テーブルへのアクセス権限（GRANT）を明示的に付与する
--
-- 背景（2026-08-06）: 0001・0002 をSupabaseのSQL Editorで実行した直後に動作確認したところ、
-- service_role キーでも全テーブルが "permission denied"（42501）で読めなかった。
-- RLSポリシーは正しく機能する前提以前の話で、Postgresの GRANT（テーブルへのアクセス権そのもの）
-- が anon / authenticated / service_role のどのロールにも与えられていなかったのが原因。
--
-- RLSはGRANTを代替しない。GRANTで「そもそも操作を試みてよいか」を通過して初めて、
-- RLSポリシーが「どの行が見えるか」を絞り込む。SQL Editorから素のCREATE TABLEを流すと、
-- Supabaseが通常の管理画面操作やCLIマイグレーションで自動的に付ける権限が付かないことがある。
--
-- これはRLSポリシーを緩めるものではない（0002の設計はそのまま）。むしろ「意図した設計どおりに
-- 動くようにする」ための、権限不足を直すだけの変更。

grant usage on schema public to authenticated, service_role;

-- service_role: RLSを迂回してすべて操作できる（来店客の匿名書き込み・管理系のバッチ処理用）
grant select, insert, update, delete on
  tenants, tags_master, stores, survey_responses, response_tags, ai_draft_logs
  to service_role;

-- authenticated: ログイン中の店舗スタッフ・運営者。実際に見える行はRLSポリシーが絞る
grant select, insert, update, delete on
  tenants, stores, survey_responses, response_tags, ai_draft_logs
  to authenticated;

-- tags_master は全店舗共通のマスタ表（RLS無効・tenant-check-allow対象）。ログイン中なら読める
grant select on tags_master to authenticated;

-- 今後このファイルより後に作るテーブルにも自動で同じ権限が付くようにする
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
