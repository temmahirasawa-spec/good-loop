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
- Figma: **検品対象は `i7z9wGL6BpFoC2kwlGA1lV`（GOOD LOOP 専用ファイル）の全ページ。**
  変数コレクション `Loop Theme`（9業態モード）も同じファイルにある。
  共通ライブラリは `KGPuY4YVRQW6BMRrulBaFN`（UTUTU）。2026-08-04 に何度か動いた（経緯は後述）
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

> **その後（同日）：検品対象を LOOP 専用ファイルに移した結果、既存の生フレーム54件を
> 登録した。0件では無くなっている。台帳は下の「Figma の負債台帳」。**

### GOOD ORDER から持ってきたもの

`CLAUDE.md` / `npm run check` / Stop hook / `.claude/settings.json` /
`docs/specs/design-rules.md` / `scripts/` の検品スクリプト。

GOOD ORDER 側のファイルは**一切変更していない**（読み取りのみ）。
なお GOOD ORDER に `harness/` というディレクトリは存在せず、ハーネスはリポジトリ直下に
散在している（`CLAUDE.md`, `.claude/`, `scripts/`, `docs/specs/`, `.github/`, `package.json`）。

### LOOP 用に変えたところ

| 項目 | 変更 |
|---|---|
| Figma file key | `KGPuY4YVRQW6BMRrulBaFN` → `i7z9wGL6BpFoC2kwlGA1lV`（同日中に往復した。最終的にこの値。経緯は後述） |
| ベースライン | 空（0件）で新規作成。GOOD ORDER の51件は持ち込んでいない（同日中に54件を登録。後述の台帳を参照） |
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

### `app/design-tokens.css` を作った（9モード × 8変数）

値は天真が Plugin API で読み出して渡したもの。**実測値で、推測値はひとつも無い。**
72件すべてを渡された表と機械的に突き合わせ、不一致0件を確認してから commit した。

- **切り替え方式は `data-loop-theme` 属性**。`<html data-loop-theme="restaurant">` で全体、
  `<div data-loop-theme="clinic">` で一部だけ切り替わる（入れ子も効く）。
  CSS変数の再定義だけで完結するので JS が要らず、SSR でも初回描画で色がちらつかない
- 属性が無いときは **Clinic**。`Loop Theme` の先頭モードだからで、
  「クリニックを主力業態と決めた」という意味ではない。変えるならセレクタ1行
- Figma のモード名 `Lodging/Sauna` は、CSS では `lodging-sauna` に正規化した
- `app/layout.tsx` で `globals.css` より先に読み込んでいる
- ⚠ `*-on-primary`（その上に乗る文字の色）は**業態ごとに黒と白が入れ替わる**。
  accent が黒文字なのは Fitness / School、cta が黒文字なのは
  Clinic / Beauty / Seikotsuin / Fitness / Pet / Lodging-Sauna。**一律に実装しないこと**

**このファイルは Figma からの写しであって、source of truth ではない。**
手で書き換えて Figma と食い違わせないこと。値が変わったら丸ごと作り直す。

### 保留 — Figma トークンのスコープ不足（急がない）

現行トークンには `file_variables:read` が無く、Variables REST API は 403 で落ちる。
今後 AI が変数を機械的に同期するには必要だが、**上記のとおり値は手渡しで足りたので急がない。**

**再発行するのは `Loop Theme` の値が実際に変わったときでよい。**

> ⚠ 再発行するときは **`~/.zshrc` と GitHub のシークレットの2か所を必ず同時に更新すること。**
> 片方だけだと、ローカルは通るのに CI が古いトークンで落ちる（またはその逆）という
> 原因の分かりにくい状態になる。

### 未解決2 — LOOP のデザイン実体が検品対象と一致していない → **解消済み**

> **2026-08-04（4回目）に解消した。** 天真が `Loop Theme` を LOOP 専用ファイルへ移設し、
> 検品対象も同じファイルに切り替えた。詳細は下の節。
> **検品は「空振りの緑」ではなくなり、実際のデザイン 3,716ノードを見ている。**

---

## 2026-08-04（4回目） — Figma ファイルの役割分担が決まった

天真が `Loop Theme` を UTUTU から **LOOP 専用ファイルへ移設**した。
**値は72個とも変わっていない**（移設後に読み戻して一致を確認済み）。

### ファイルの役割分担（天真が決定）

| ファイル | 役割 |
|---|---|
| `KGPuY4YVRQW6BMRrulBaFN`（UTUTU） | **共通ライブラリ。** 色・余白・角丸・サイズ・文字・共通コンポーネント。ライブラリとして公開する |
| `i7z9wGL6BpFoC2kwlGA1lV`（GOOD LOOP） | **LOOP のデザイン実体 ＋ LOOP専用トークン（`Loop Theme`）** |

GOOD ORDER も他サービスも同じ形にする（基本＝UTUTU、専用＝各プロダクトのファイル）。

### `Loop Theme` の新しい所在

| 項目 | 値 |
|---|---|
| ファイル | `i7z9wGL6BpFoC2kwlGA1lV` |
| コレクション ID | `VariableCollectionId:29:812` |
| コレクション key | `704fe2858d736c9a125b703d0c58a53ff0737812` |

UTUTU 側の `Loop Theme` は削除済み。UTUTU に残るのは
`Spacing` / `Radius` / `Size` / `Color` / `Brand Core` / `Brand Product` の6コレクション。

### `--loop-` 接頭辞の理由が変わった（付けるのは変わらない）

UTUTU の `Brand Product` 側が `product/accent-primary` 等に改名されたため、
**名前の衝突はもう起きない。** それでも接頭辞を付ける理由は、
**LOOP専用トークンと、将来 UTUTU から読み込む共通トークンを CSS上で見分けるため。**

### 検品の設定を見直した

`scripts/check-figma.mjs` の `FILE_KEY` を LOOP 専用ファイルに差し替え、
ページ設定を実測にもとづいて見直した（判断の理由は PR 本文に記載）。

| 設定 | 値 | 理由 |
|---|---|---|
| 方式 | 許可リスト → **除外リスト**に戻した | ファイルの中身がすべて LOOP のもの。新しいページを作ったら登録しなくても対象に入る。許可リストだと登録し忘れが黙って見逃される |
| `SKIP_PAGES` | `["---"]` | ページ一覧の見た目を区切るためだけの空ページ |
| `SCREEN_PAGES` | `App Design Master` / `Web Design Master` | 画面制作のページ。`Components` はコンポーネント置き場であって画面ではないので入れない |
| `PAIR_EXEMPT_SECTIONS` | `01` と `02-A`〜`02-I` の10セクション | 中身が**すべて 390px 幅**（実測）＝来店客側の SP 専用画面。PC を要求しても意味のない PC版を9業態ぶん作らせるだけになる。`06 Dashboard`（管理画面）は PC 主なので入れない |

**免除したセクションは SP 扱いになり、タップ領域44px以上の検査対象になる**
（対を免除するかわりに、SP としての品質は見る）。実行したところ、この検査での違反は0件だった。

設定に書いたページ名・セクション名が Figma に実在しないと検品はエラーで落ちる仕掛けを足した。
名前を変えたときに「見ているつもりで見ていない」状態にならないようにするため。

### 検品の現状 — **構造は 0件。資産の質だけが残っている**

一度は構造35件・資産48件（対象ノード3,716個）が出たが、**天真が Figma 側を修正し、
構造・パディング・セクション色の違反は0件になった**（再実行して確認済み）。

修正された内容は以下。

| 前の状態 | 修正後 |
|---|---|
| 最上位セクションの `x` が0でない 14件 | `App Design Master` 11個・`Components` 3個をすべて `x=0` に |
| `06 Dashboard` の直下が `06-PC / Desktop 1440` `06-SP / Mobile 390` | `PC` / `SP` に改名 |
| パディング 80 / 120 / 160px 16件 | 全セクション4辺とも 100px |
| セクション間隔 200px 1件 | 100px |
| （追加）セクション色 | 大枠 `#7E7E7E` / 中枠 `#444444` を全14セクションに適用 |
| `Web Design Master` の裸のフレーム | `01 LP / GOOD LOOP` セクションで包み、その下に `PC` を作った |

### `01 LP / GOOD LOOP` を対の検査から暫定除外した

LP をセクションで包んだ結果、`SP セクションがありません` が新しく出るようになった。
**これは本当の未対応**（LP の SP版がまだ存在しない）。ただし CI を赤で止め続ける意味が
無いので、`PAIR_EXEMPT_SECTIONS` に暫定で入れてある。

**「作らなくてよい」ではなく「まだ作っていない」。SP版を作ったらこの行を消すこと。**

### 免除セクションの SP 扱いに不具合があったので直した

「免除したセクションは SP 扱いにしてタップ領域を検査する」という実装が、
**サブセクションを持つ場合に `PC` まで SP 扱いにしていた。**
`01 LP / GOOD LOOP` は `PC` サブセクションを持つので、1440px の LP に
「タップ領域44px以上」を要求してしまう。

`PC` / `SP` に分かれている場合はサブセクションの名前で判定し、
分かれていない免除セクションだけを SP 扱いにするよう直した。

---

---

## Figma の負債台帳（2026-08-04 時点）

**生フレーム54件をベースラインに登録した。「直したから0件」ではない。
`npm run design:figma` は緑だが、それは「未返済の負債が54件ある」ことを意味する。**

ベースラインは**「今より増えた分だけを落とす」ための基準線**であって、
返済の完了を意味しない。緑を見て「Figma はきれい」と読まないこと。

### 台帳に載っている54件

| ページ | セクション | ノード名 | 件数 |
|---|---|---|---|
| App Design Master | `02-A  Clinic / クリニック（緑・清潔）` | `CTA Block` | 2 |
| App Design Master | `02-B  Restaurant / 飲食店（バーミリオン・食欲）` | `CTA Block` | 2 |
| App Design Master | `02-C  Salon / 美容室（ブラス・上質）` | `CTA Block` | 2 |
| App Design Master | `02-D  Beauty / エステ・美容（ローズ・やわらか）` | `CTA Block` | 2 |
| App Design Master | `02-E  Seikotsuin / 整骨院（ネイビー・信頼）` | `CTA Block` | 2 |
| App Design Master | `02-F  Fitness / フィットネス（ボルト・活力）` | `CTA Block` | 2 |
| App Design Master | `02-G  School / スクール（アンバー・親しみ）` | `CTA Block` | 2 |
| App Design Master | `02-H  Pet / ペット（スカイ・やさしい）` | `CTA Block` | 2 |
| App Design Master | `02-I  Lodging & Sauna / 宿泊・サウナ（常緑・整い）` | `CTA Block` | 2 |
| App Design Master | `06 Dashboard / 全店一覧 3案 / PC` | `Chip / 直近7日` `直近14日` `今月` `直近3ヶ月`（各3）＋`変化順` `レビュー増加順` `送客率順`（各1） | 15 |
| App Design Master | `06 Dashboard / 全店一覧 3案 / SP` | 同上 | 15 |
| Web Design Master | `01 LP / GOOD LOOP / PC` | `Hero CTAs` `btn-primary`×3 `Final CTA` `final-ctas` | 6 |

**違反の種類は54件すべて「生のフレームで作られている」**（＝既存コンポーネントを使っていない）。
1行ずつの明細は PR #4 の本文にある。返済するときはそれを作業リストとして使う。

> **2026-08-04 追記：ベースラインを件数つき形式に変更した。
> 同じ違反が増えたことも検出できるようになった。** 詳細は下の「ベースラインの仕組み」。
> 台帳の中身（54件 / 27種類）は移行の前後で1件も変わっていない。

### タップ領域15件は凍結していない。Figma 側で修正済み

一度は `06 Dashboard / SP` の `Chip / …` に「高さ34px（SPのタップ領域は44px以上）」が
15件出たが、**天真が Figma で 34px → 44px（上下パディング 8→13）に修正した。**
デザインと文字サイズは変えていない。**台帳には載せていない。**

同じ議論を繰り返さないために書き残す ──
**あれはベースラインで黙らせたのではなく、直したもの。**

### ベースラインの仕組み（2026-08-04 に件数つき形式へ変更）

**キーごとに件数を記録する。「同じ違反が増えたこと」も検出できる。**

| 状況 | 結果 |
|---|---|
| キーが台帳に無い | **落とす**（新しい種類の違反） |
| キーがあり、今回の件数 ≤ 台帳の件数 | 通す |
| キーがあり、今回の件数 > 台帳の件数 | **落とす**。「1件で登録されていたものが2件に増えています（+1）」と出す |
| キーがあり、今回の件数 < 台帳の件数 | 通す。「返済が進んだもの」として報告する |

**件数が減っても台帳は自動では書き換わらない。** 書き換わるのは `--update-baseline` を
明示的に叩いたときだけ。勝手に基準線が下がると、返済したことに気づけなくなる。

- ファイル形式は `{ total, keys, counts: { "セクション :: メッセージ": 件数 } }`。
  **`total` 54 / `keys` 27**。1種類あたり複数件あるので、この2つは一致しない
- 旧形式（キーの配列）が置かれていたら、黙って読み替えずエラーで落とす。
  件数を持たない台帳を「全部1件ずつ」と誤解すると、いきなり大量に落ちるため
- `--update-baseline` は**資産の質（soft）だけ**を書き出す。構造違反は原理的に混入しない。
  **正しい確認は「構造違反が0件で終了していること」。件数そのものは増減してよい**

---

## 次にやること

1. **負債の返済** — 生フレーム54件を既存コンポーネントに置き換える（Figma 側の作業）
2. LP の SP版を作り、`PAIR_EXEMPT_SECTIONS` から `01 LP / GOOD LOOP` を外す
3. 天真が Supabase / Sentry のプロジェクトを作成し、環境変数を登録する
4. 画面の実装に着手する。`data-loop-theme` をどこで付けるか（テナントの業態から引く）は
   Supabase のスキーマが決まってから
