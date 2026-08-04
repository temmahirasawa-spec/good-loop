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
- Figma: file key `KGPuY4YVRQW6BMRrulBaFN`（UTUTU の共有ファイル）。
  検品対象は `GOOD LOOP` / `GOOD LOOP LP` の2ページだけ。2026-08-04 に変更（後述）
- Slack 通知先: `#goodloop_monitoring`

---

## 2026-08-04 — 土台とハーネスの構築

このリポジトリの最初の作業。**機能・テーブル・画面は1つも作っていない。**

### やったこと

1. `good-loop` リポジトリを public で作成
2. **ハーネスを Next.js より先に入れた**（後述）
3. LOOP 固有のチェックを2つ追加（テナントID、秘密情報）
4. Next.js の土台と動作確認用ページを1枚だけ追加
5. GitHub Actions / ブランチ保護（**Vercel 連携はこの時点では未実施。8/4 の2回目で実施**）

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
| Figma file key | `KGPuY4YVRQW6BMRrulBaFN` → `i7z9wGL6BpFoC2kwlGA1lV`（**8/4 に `KGPu…` へ戻した。後述**） |
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

> この節の数字は**旧・専用ファイル `i7z9wGL6BpFoC2kwlGA1lV` を対象にしたときのもの**で、
> 検品対象を変更した現在は使わない。同日あとから測り直した確定値は下の節にある。

`npm run design:figma` を通したところ、構造13件・新規違反18件が出ている。
ただし**この作業と並行して別セッションが Figma を編集中**だったため、確定した数字ではない。
**ベースラインには登録していない。** デザイン作業に着手するセッションで、
編集が落ち着いた状態で改めて検品し、直すこと。

- 構造: 最上位セクションの `x` が 0 でない（`App Design Master` 10件 / `Components` 3件）
- 新規違反: `CTA Block` が生のフレーム（9業態テーマ × 2）
- セクション色は違反0件（＝既に規約どおりの色になっている）
- 参考値: 未バインドの塗り 143 / テキストスタイル未適用 192

---

## 2026-08-04（2回目） — Vercel 連携と Figma 検品の対象変更

### Vercel

`good-loop` プロジェクトを作成し、GitHub リポジトリと接続した。

| 項目 | 値 |
|---|---|
| Project | `good-loop`（`prj_fmcLsdYCODJbRcNU9Bzhky97eNxR`） |
| Team | `temmahirasawa-1946's projects` |
| Git 接続 | `temmahirasawa-spec/good-loop`（GitHub） |
| Production Branch | `main` |
| PR へのコメント | 有効（`gitComments.onPullRequest = true`）＝PR にプレビューURLが付く |
| 関数リージョン | `hnd1`（プロジェクト設定と `vercel.json` の両方） |
| Framework | Next.js / Node 24.x |

- `vercel link` が `.gitignore` の末尾に `.env*` を追記したが、これは既存の
  `!.env.local.example` を打ち消してしまうため**取り消した**。
  秘密情報の除外は 28〜34 行目の既存ルールで足りている
- `vercel link` が生成した `.env.local`（`VERCEL_OIDC_TOKEN` 入り）はローカルのみ。
  `.gitignore` 済みで、`npm run secrets` でも検出されないことを確認した

**注意：プロジェクト作成後の「最初の1回」だけ、feature ブランチが production 扱いでデプロイされる。**

Production Branch を `main` に設定してあるにもかかわらず、
`chore/vercel-and-figma-qa` からの初回デプロイが `target: production` になった。
これは Vercel が「まだ production デプロイが1つも無いプロジェクト」の最初のデプロイを
production として扱うため。設定ミスではない。

`main` に何か入った時点で production は `main` の内容に置き換わる。
2回目以降の feature ブランチへの push は、正しく preview になることを確認済み。

### Figma 検品の対象ファイルを変更した

**`i7z9wGL6BpFoC2kwlGA1lV`（GOOD LOOP 専用ファイル）→ `KGPuY4YVRQW6BMRrulBaFN`（UTUTU 共有ファイル）**

このファイルは GOOD ORDER など他プロダクトのページと同居しているため、
`scripts/check-figma.mjs` を**除外リスト（`SKIP_PAGES`）から許可リスト（`TARGET_PAGES`）に変えた**。
`GOOD LOOP` / `GOOD LOOP LP` の2ページだけを見る。
許可リストのページがファイルに無い場合は、黙って0件で通さずエラーで落とす。

**この2ページは、2026-08-04 時点で実質空です。**

| ページ | 中身 |
|---|---|
| `GOOD LOOP` | 要素0個 |
| `GOOD LOOP LP` | フレーム1枚（`Font Specimen / 見出し候補`）。セクション未使用なのでスキップされる |

したがって `npm run design:figma` は緑だが、**ノード数0の空振りの緑**である。
これは天真の判断（今後この2ページにデザインを作っていく前提）。

### 旧・専用ファイルに残っているもの（参考・2026-08-04 実測）

`i7z9wGL6BpFoC2kwlGA1lV` にはデザインの実体が残っている（ノード3,716個）。

- `App Design Master` — 評価UI 5案、9業態テーマ（02-A〜02-I）、全店一覧3案
- `Web Design Master` — `LP / Restaurant — Desktop`
- `Components` — コンポーネント、業態別カラー、LP用コンポーネント

同じ基準で検品すると **構造・パディング35件 / 資産の質48件** が出る。内訳は以下。

- 最上位セクションの `x` が 0 でない … 14件（`-1207` / `-989`）
- `06 Dashboard` の直下が `06-PC / Desktop 1440` `06-SP / Mobile 390`。規約の `PC` / `SP` でない … 4件
- パディングが 80 / 120 / 160px … 16件、セクション間隔 200px … 1件
- `CTA Block`（9業態×2）と `Chip / …`（PC/SP）が生フレーム … 48件
- セクション色の違反は0件。未バインドの塗り149 / テキストスタイル未適用192

**この数字はベースラインに入れていない。** 検品対象外のファイルなので、
`scripts/figma-check-baseline.json` は0件のままにしてある。
（対象ページが空である以上、`--update-baseline` を打っても0件のまま変わらない）

### `Loop Theme` はどちらのファイルにあるか → 決着済み（下の節を参照）

Figma の Variables API（`/v1/files/:key/variables/local`）は**両ファイルとも 403** だった。

> **訂正（同日）：この 403 は Enterprise プランの制限ではなく、トークンのスコープ不足だった。**
> 返ってきていたのは `Invalid scope(s): file_content:read. This endpoint requires the
> file_variables:read scope`。現行トークンは `file_content:read` だけで発行されている。

---

## 2026-08-04（3回目） — `Loop Theme` の所在が確定した

先に済んだこと：PR #1 / #2 はマージ済み。GitHub の `FIGMA_TOKEN` も登録済みで、
CI の `figma` ジョブが**実際に Figma API を叩いて検品している**ことを再実行で確認した
（「未登録のためスキップ」ではない）。Vercel の production も `main` から出るようになった。


天真が Figma Plugin API（`getLocalVariableCollectionsAsync`）で UTUTU ファイルを直接読んで確認。
**推測ではなく実測値。**

| 項目 | 値 |
|---|---|
| ファイル | **`KGPuY4YVRQW6BMRrulBaFN`（UTUTU 共有ファイル）** |
| コレクション ID | `VariableCollectionId:978:8248` |
| コレクション key | `2beb5cc98edc5a6cd9cfba2f7a0b78e2124fe429` |
| `remote` | `false`（＝このファイルが持ち主。他ファイルからの読み込みではない） |
| モード（9業態） | Clinic / Restaurant / Salon / Beauty / Seikotsuin / Fitness / School / Pet / Lodging-Sauna |
| 変数（8） | `accent/primary` `accent/light` `accent/action` `accent/wash` `accent/on-primary` `cta/primary` `cta/action` `cta/on-primary` |

**検品対象ファイルとトークンの供給元は同じ UTUTU。分離していない。**
旧・専用ファイル `i7z9wGL6BpFoC2kwlGA1lV` には無い。

### 変数名が3コレクションで重複している → CSS変数には `--loop-` を必ず付ける

- `accent/primary` … `Color` / `Brand Product` / `Loop Theme` の3つに存在
- `accent/light` `accent/action` `accent/wash` … `Brand Product` / `Loop Theme` の2つに存在

変数名からそのまま CSS変数名を生成すると衝突する。
`--loop-accent-primary` / `--brand-accent-primary` / `--color-accent-primary` のように、
**コレクション名を接頭辞に入れる。** これは `CLAUDE.md` の規約に上げた。

### 未解決1 — `app/design-tokens.css` はまだ作れていない

9モード × 8変数の**実際の色の値**が手元に無い。理由は2つ。

1. Variables REST API はトークンのスコープ不足で 403（`file_variables:read` が無い）
2. **`Loop Theme` は現時点でどこにも使われていない**（UTUTU 全ページを走査して適用数0件）。
   ノードに当たっていないので、`get_variable_defs` など「ノード経由で変数を読む」経路も使えない

値を推測して置くことはしない（`CLAUDE.md` 3章・4章に反する）。
先に進めるには、次のどちらかが要る。

- **案A**: `file_content:read` ＋ `file_variables:read` の2スコープでトークンを発行し直す
  → 以後 AI が機械的に同期できる。`~/.zshrc` と GitHub シークレットの両方を更新すること
- **案B**: 天真がプラグインで 9モード × 8変数の HEX を書き出して渡す
  → 今回は早いが、値が変わるたびに人手が要る

### 未解決2 — LOOP のデザイン実体が検品対象と一致していない

**検品対象（UTUTU）とデザインの実体（旧・専用ファイル）が別々の場所にある。**

| 場所 | 中身 |
|---|---|
| UTUTU `GOOD LOOP` ページ | 0件 |
| UTUTU `GOOD LOOP LP` ページ | フォント見本 1枚だけ |
| 旧・専用 `i7z9wGL6BpFoC2kwlGA1lV` | 3,716ノード。9業態テーマ・評価UI 5案・全店一覧3案・コンポーネント一式 |

このままだと **`npm run design:figma` は永久に「空振りの緑」**になる。
検品が緑でも、実際のデザインは1つも見ていない。

**デザインをどちらに集約するかは天真の判断待ち。** AI は決めないこと。
（`Loop Theme` が UTUTU にあり、そこにデザインが無い、という食い違いでもある）

---

## 次にやること

1. **天真の判断** — `Loop Theme` の値をどう取るか（上の未解決1、案A / 案B）
2. **天真の判断** — LOOP のデザインをどちらの Figma ファイルに集約するか（上の未解決2）
3. 値が手に入ったら `app/design-tokens.css` を作る。CSS変数名は `--loop-` 接頭辞
4. 天真が Supabase / Sentry のプロジェクトを作成し、環境変数を登録する
5. `GOOD LOOP` / `GOOD LOOP LP` ページにデザインを作る。
   その際 `scripts/check-figma.mjs` の `SCREEN_PAGES` にページ名を足す
   （＝セクションに `PC` / `SP` の対を必須にする）
6. 画面の実装に着手する
