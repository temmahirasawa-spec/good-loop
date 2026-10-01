-- GOOD REVIEW: 来店客のアンケートを v5 にして本番（/r/[storeSlug]）へ載せる
--
-- 対応する仕様: docs/specs/survey-v5.md §7（本番化のときに決めること）。1機能1ファイル（CLAUDE.md 4章）。
-- 2026-10-01、天真の決定「本番の来店客の画面を今すぐ v5 に」で着手。
-- ⚠ **実行は天真。** CLAUDE.md 3章「DBのスキーマ変更」に当たるため、PR で承認を得てから流す。
-- ⚠ **コードをマージ（＝本番に反映）する前に、このSQLを先に実行すること。**
--   順番が逆だと、v5 の回答の保存が「列が無い」で失敗する（画面は止まらないが、回答が残らない）。
--
-- やること（**追加だけ。既存の列・行・ポリシーは変えない**）
--   1. survey_responses に v5 の回答の形を足す
--      - branch（good / improve）は消さない。v5 では★から導いた「★の帯」（★4以上＝good）を入れ続ける。
--        管理画面の絞り込み（lib/admin/queries.ts）がそのまま動くようにするため。
--        **行き先を★で決めるためには使わない**（v5 は★で行き先を分けない）
--   2. 来店客向けの API の回数の記録（survey_requests）。AIの「つなげる」と回答の送信の上限に使う

-- ── 1. v5 の回答 ─────────────────────────────────────────────

-- 'v5' … v5 の画面からの回答。旧い画面（★で振り分けていた版）の行は null のまま
alter table survey_responses add column if not exists flow text
  check (flow in ('v5'));

-- 来店客が選んだ届け先。★とは関係なく、本人が選ぶ（案I）
alter table survey_responses add column if not exists destination text
  check (destination in ('google', 'store'));

-- 文章も書いたか（「★だけで評価する」「★評価だけを届ける」は false）
alter table survey_responses add column if not exists wrote boolean;

-- ②「印象に残ったこと」で選んだ話題（lib/survey/v5-topics.ts の id。選んだ順）
alter table survey_responses add column if not exists topics text[] not null default '{}';

-- 話題ごとの欄に本人が書いた言葉（{ "food": "…", "other": "…" }）。
-- 完成した文章（AIがつないだもの、または本人の言葉のまま）は既存の free_text に入れる
alter table survey_responses add column if not exists fields jsonb;

-- 完成した文章に「AIがつなげた文」を使ったか（元の言葉のまま・直した場合は false）
alter table survey_responses add column if not exists ai_joined boolean;

-- ── 2. 来店客向け API の回数の記録 ────────────────────────────
-- tenant-check-allow: 来店客が使う API（AIでつなげる・回答の送信）の回数の記録。IPのハッシュだけを持ち、特定の店舗に属さない
create table if not exists survey_requests (
  id uuid primary key default gen_random_uuid(),
  -- 生のIPアドレスは保存しない。sha256(AI_CHECK_IP_SALT + IP) だけを持つ（lib/ai-check/rate-limit.ts と同じ作り方）
  ip_hash text not null,
  -- polish … AIでつなげる（欄ごとに1回）／ response … 回答の送信
  kind text not null check (kind in ('polish', 'response')),
  created_at timestamptz not null default now()
);

-- IPごとの直近1時間の数え上げに使う
create index if not exists survey_requests_ip_kind_created_idx
  on survey_requests (ip_hash, kind, created_at desc);

-- 全体の1日上限の数え上げと、古い行の削除に使う
create index if not exists survey_requests_kind_created_idx
  on survey_requests (kind, created_at desc);

alter table survey_requests enable row level security;
revoke all on survey_requests from anon, authenticated;
grant select, insert, delete on survey_requests to service_role;
