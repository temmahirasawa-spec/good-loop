# GOOD LOOP 引き継ぎメモ

**セッション開始時にこのファイルを読むこと。** 規約は `CLAUDE.md`、Figma の作法は
`docs/specs/design-rules.md`。ここには**そこに書ききれない経緯と判断の履歴**を残す。

---

## プロジェクトの概要

**GOOD LOOP** — 実店舗向けの「Googleレビュー獲得 × 顧客満足度アンケート」SaaS。
株式会社UTUTU（洋輔 × 天真）の自社プロダクト。GOOD ORDER と同じ GOODシリーズ。

来店客が卓上POPのQRを読み、5段階評価に答える。
★4〜5 は AI が書いたクチコミ下書きをコピーして Google マップへ、
★1〜3 は店内向けの改善アンケートへ分岐する（低評価を公開レビューに出さない）。

- リモート: https://github.com/temmahirasawa-spec/good-loop （**public**）
- Figma: file key `i7z9wGL6BpFoC2kwlGA1lV`（変数コレクション `Loop Theme` ＝9業態モード）
- Slack 通知先: `#goodloop_monitoring`

---

## 2026-08-04 — 土台とハーネスの構築

このリポジトリの最初の作業。**機能・テーブル・画面は1つも作っていない。**

### やったこと

1. `good-loop` リポジトリを public で作成
2. **ハーネスを Next.js より先に入れた**（後述）
3. LOOP 固有のチェックを2つ追加（テナントID、秘密情報）
4. Next.js の土台と動作確認用ページを1枚だけ追加
5. GitHub Actions / ブランチ保護 / Vercel 連携

### なぜハーネスを先に入れたか

GOOD ORDER では、既にコードとデザインがある状態にハーネスを後から入れたため、
**「既にある違反を許容リストに登録する」作業**が発生した。その結果、
`scripts/figma-check-baseline.json` に51件の負債が乗った状態から始まっている。

GOOD LOOP では中身が無いうちにハーネスを入れたので、この作業がゼロで済んだ。
**`scripts/figma-check-baseline.json` は空（0件）で始まっている。**
ここを増やすのは、返済されない負債を増やすということ。安易に `--update-baseline` を使わないこと。

### GOOD ORDER から持ってきたもの

`CLAUDE.md` / `npm run check` / Stop hook / `.claude/settings.json` /
`docs/specs/design-rules.md` / `scripts/` の検品スクリプト。

GOOD ORDER 側のファイルは**一切変更していない**（読み取りのみ）。
なお GOOD ORDER に `harness/` というディレクトリは存在せず、ハーネスはリポジトリ直下に
散在している（`CLAUDE.md`, `.claude/`, `scripts/`, `docs/specs/`, `.github/`, `package.json`）。

### LOOP 用に変えたところ

| 項目 | 変更 |
|---|---|
| Figma file key | `KGPuY4YVRQW6BMRrulBaFN` → `i7z9wGL6BpFoC2kwlGA1lV` |
| ベースライン | 空（0件）で新規作成。GOOD ORDER の51件は持ち込んでいない |
| セクション色 | 大枠 `#7E7E7E` / 中枠 `#444444` を機械チェックに追加 |
| `SCREEN_PAGES` | 空。画面制作ページを作ったら `scripts/check-figma.mjs` に足すこと |
| デザイントークン | `app/design-tokens.css` が未作成でも通るようにした（Figma 同期前のため） |
| Sentry | `next.config.mjs` から外した。プロジェクト作成後に入れる |

### 追加した2つのチェック

どちらも「機械が判定できるのに、人間が見張っていた」ものを制約に上げたもの。

- **`npm run tenant`**（`scripts/check-tenant.mjs`）
  `supabase/` 配下の `CREATE TABLE` に `tenant_id` 列と RLS の有効化を要求する。
  RLS まで見ているのは、列があっても RLS が無ければ行が分離されないため。
  現時点でテーブルは0個なので何も検出せずに通る。
- **`npm run secrets`**（`scripts/check-secrets.mjs`）
  コミット対象のファイルから Supabase のサービスキー・JWT、Figma / Anthropic / GitHub /
  AWS / Sentry のトークン、Slack Webhook、秘密鍵、`.env` ファイルを検出する。
  **public リポジトリなので、これが最後の砦。**

### 判断したこと・保留したこと

- **Next.js のバージョンは 14.2.35**（GOOD ORDER と同じ）にした。
  ただし 14.x には既知の脆弱性告知が多数あり、`npm audit` は high を報告する。
  中身がゼロの今が Next 16 に上げる最も安いタイミングではある。**天真の判断待ち。**
- **Sentry と Supabase のクライアントは入れていない。** どちらもプロジェクトが未作成で、
  DSN と接続情報が無い。天真が管理画面で作成したあとに入れる
- **`app/design-tokens.css` はまだ無い。** Figma の `Loop Theme`（9モード）を同期する
  作業は、画面の実装に着手するセッションで行う

### 触ってはいけないもの

洋輔さんが作った**実動プロトタイプ**が別系統で既に3店舗で動いている。

- 静的HTML ＋ Netlify ＋ Netlify Functions（Anthropic API でクチコミ生成）
- Supabase プロジェクト `jqvyepvjxnkpirusesxg`

**GOOD LOOP とは別物。参照も改変もしない。** GOOD LOOP 完成時に洋輔さんが乗り換える。
**データ移行はしない。**

### Figma の現状（2026-08-04 時点・読み取りのみ）

`npm run design:figma` を通したところ、構造13件・新規違反18件が出ている。
ただし**この作業と並行して別セッションが Figma を編集中**だったため、確定した数字ではない。
**ベースラインには登録していない。** デザイン作業に着手するセッションで、
編集が落ち着いた状態で改めて検品し、直すこと。

- 構造: 最上位セクションの `x` が 0 でない（`App Design Master` 10件 / `Components` 3件）
- 新規違反: `CTA Block` が生のフレーム（9業態テーマ × 2）
- セクション色は違反0件（＝既に規約どおりの色になっている）
- 参考値: 未バインドの塗り 143 / テキストスタイル未適用 192

---

## 次にやること

1. 天真が Supabase / Sentry / Vercel のプロジェクトを作成し、環境変数を登録する
2. Figma の `Loop Theme` を `app/design-tokens.css` に同期する
3. Figma の構造違反を直す（別セッションの編集が落ち着いてから）
4. 画面の実装に着手する
