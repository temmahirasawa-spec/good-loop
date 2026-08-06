-- GOOD LOOP: tags_master がログイン中セッションから読めない不具合の修正
--
-- 経緯（2026-08-06）: 0001 では tags_master に RLS を付けていない（tenant-check-allow：
-- 全店舗共通のマスタ表であり、店舗に属さないため）。ところが、フェーズ5で初めて
-- 「ログイン中ユーザーのセッション」で tags_master を読む実装（設定・アンケート項目の
-- プリセット取得）を追加したところ、0件しか返らないことが判明した。
--
-- 調査の結果、service_role では11件見えるのに、authenticated ロールのセッションでは
-- エラー無しで0件になる。GRANT（0003で select を authenticated に付与済み）は
-- 効いているはずなので、これは「RLSが有効化されているのにポリシーが無い」状態
-- （Postgresの既定動作：ロールがオーナーでない限り、ポリシー0件＝全行拒否）でしか
-- 説明がつかない。0001はRLSを有効化していないため、Supabaseダッシュボードの
-- 「RLSが無効です」という警告に従って後から個別に有効化された可能性が高い。
--
-- tags_master は非機密の共通データ（タグの選択肢文言）であり、テナント分離の対象外
-- （tenant-check-allowの理由どおり）。ログイン中なら誰でも読めてよいものなので、
-- 全authenticatedユーザーへの読み取り許可は「RLSを緩める」には当たらないと判断した
-- （CLAUDE.md 4章）。念のため、天真に事後報告のうえこのファイルを追加している。

alter table tags_master enable row level security;

create policy "tags_master: readable by authenticated" on tags_master
  for select
  to authenticated
  using (true);
