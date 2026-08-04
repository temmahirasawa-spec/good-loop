# CLAUDE.md — GOOD LOOP

このファイルはこのリポジトリの**規約**です。作業を始める前に必ず読み、以下に従ってください。
流動的な実装の経緯・判断の履歴は `docs/handoff.md` にあります。実装に入る前にそちらも読んでください。

---

## 1. このリポジトリについて

**GOOD LOOP** — 実店舗向けの「Googleレビュー獲得 × 顧客満足度アンケート」SaaS。
株式会社UTUTU（洋輔 × 天真）の自社プロダクト。**GOOD ORDER と同じ GOODシリーズ**。

来店客の体験は1本道です。

1. 卓上POPのQRを読む
2. 5段階評価に答える
3. **★4〜5** → AI が書いたクチコミの下書きをコピーして Google マップへ
   **★1〜3** → 店内向けの改善アンケートへ分岐（＝低評価を公開レビューに出さない）

店舗側には、満足度ヒートマップ・NPS・評価内訳・トレンド・AIインサイト・多店舗の一元管理を持つ
管理画面が載る予定。**業態別テーマ**（Figma の `Loop Theme` ＝9モードの変数コレクション）で、
モード切替だけで全画面の色が変わる設計にする。実装は CSS変数で受ける。

スタック: Next.js 14 App Router / TypeScript (strict) / Tailwind / Supabase (Postgres・Auth・RLS) / Vercel

### 触ってはいけない別系統がある

洋輔さんが作った**実動プロトタイプ**が、別系統で既に3店舗で動いています。

- 静的HTML ＋ Netlify ＋ Netlify Functions（Anthropic API でクチコミ生成）
- Supabase プロジェクト `jqvyepvjxnkpirusesxg`

**これは GOOD LOOP とは別物です。参照も改変もしないこと。**
GOOD LOOP が完成した時点で洋輔さんが乗り換えます。**データの移行はしません。**

### 天真とのやりとり

- **常に日本語で応答する。** 英語で書かない
- **天真はエンジニアではない。** 専門用語を使うときは、必ず直後に「＝何が起きるか」を平易な言葉で添える
  - 例：「ブランチを切ります（＝正式版のコピーを作ります。本番には影響しません）」
- **確認を求めるときは、以下を必ず書く**
  1. 何をしようとしているか（日本語で、1文）
  2. それをすると何が起きるか
  3. やらなかった場合どうなるか
  4. 取り消せるかどうか
- **「〜してもいいですか？」だけの質問をしない。** 判断材料が無いまま承認を求めない
- **選択肢がある場合は、番号をつけて、それぞれ何が違うかを1行で書く**

---

## 2. 完了の定義

**`npm run check` が通っていない作業は、完了ではありません。**

- 「実装しました」「修正しました」と報告する前に、**必ず自分で `npm run check` を実行する**
- 落ちたら、報告せずに**自分で直してから**再実行する。通るまで繰り返す
- 人間に「エラーが出ました、どうしますか」と投げ返さない。それは作業を完了させていないのと同じ
- 3回直しても同じ箇所で落ちる場合だけ、**何を試して何が起きたか**を添えて相談する

`npm run check` の中身は6つ。1つでも落ちたらそこで止まります。

| 段 | コマンド | 何を見るか |
|---|---|---|
| 1 | `typecheck` | `tsc --noEmit` |
| 2 | `lint` | `next lint --max-warnings 0` |
| 3 | `secrets` | 秘密情報の混入（`scripts/check-secrets.mjs`） |
| 4 | `tenant` | テナントIDとRLS（`scripts/check-tenant.mjs`） |
| 5 | `design` | 生の色コード（`scripts/check-design-tokens.mjs`） |
| 6 | `build` | `next build` |

Figma 側の検品は `npm run design:figma` で別に走ります（`check` には含めない。ネットワークと
Figma のトークンが要るため）。デザイン作業をしたときは必ず通すこと。

これは口約束ではなく**機構**です。`.claude/hooks/require-check.sh`（Stop hook）が、
AIが「完了しました」と応答を終えようとするたびに `npm run check` を走らせ、
落ちたら停止を拒否してエラーをAIに突き返します（最大3回まで自動で直させる）。

画面に見える変更を加えた場合は、`npm run check` に加えて、ブラウザで該当ページを開いて
スクリーンショットを撮り、それを提示するまでを完了とする。撮るのは **PC幅 1400px** と
**スマホ幅 390px** の2枚。dev サーバーが起動していない場合は、**起動を求めて止まる**こと
（勝手にバックグラウンドで起動しない）。

---

## 3. 止まって確認すること / 自分で判断してよいこと

### 必ず止まって天真に確認する

- **デザインの意思決定** — Figma に対応するノード・変数が無く、レイアウト／配色／タイポを自分で決める必要があるとき
- **評価の分岐ロジックの変更** — 何点で Google マップに送り、何点で店内アンケートに送るか
- **AI が生成するクチコミ下書きのプロンプト** — 何を書かせるか、何を書かせないか
- **クライアント・来店客の目に触れる文言** の新規作成や変更
- **DBのスキーマ変更・破壊的マイグレーション** — 列の削除、型変更、RLSポリシーの緩和
- **外部公開される内容** の変更 — OGP、manifest、sitemap、robots、公開URL

### 確認せずに自分で判断して進めてよい

以下でいちいち止まらないでください。止まることは安全ではなく、単に作業が進まないだけです。

- **Figma に定義済みのデザインの実装** — 対応するノードや変数がある実装は「判断」ではなく「写し取り」。自走してよい
- `app/design-tokens.css` に定義済みのトークンの適用
- 型エラー・lintエラー・ビルドエラーの修正
- リファクタリング、命名、ファイル分割（公開挙動が変わらない範囲）
- `docs/handoff.md` の更新
- コミットとpush（下記 8 を参照）

判断に迷ったら、**まず `docs/handoff.md` の過去の判断履歴を探す**こと。同じ論点が既に決着している場合が多い。

---

## 4. 技術規約

実装を始める前に、`docs/specs/` 配下に該当する仕様ファイルがないか確認し、あれば必ず読むこと。
仕様に書かれていない判断が必要になった場合、および仕様と異なる実装が必要になった場合は、
勝手に進めず天真に確認すること。

Figma でデザイン作業を行う場合は、着手前に必ず `docs/specs/design-rules.md` を読むこと。
同ファイルの「4. 完了の定義」を満たすまで作業完了としないこと。特に、ピクセルを作る前に
操作の流れを文章で合意すること、案は必ず3つ出すこと、PC を作るときは SP も対で作ること、
作業の最後に整理整頓と `npm run design:figma` を通すことは必須。

### このリポジトリは public です

- `.env.local` は**絶対にコミットしない**。実値を書いてよいのは `.env.local` だけ
- 例を書きたいときは `.env.local.example` に**プレースホルダで**書く
- これは `npm run secrets` が機械的に検出する（`scripts/check-secrets.mjs`）。
  Supabase のサービスキー・JWT、Figma / Anthropic / GitHub / AWS / Sentry のトークン、
  Slack の Webhook URL、秘密鍵の中身、`.env` ファイルそのものを落とす
- **1度でも push したら、履歴から消しても漏洩したものとして扱う**（キーの再発行が必要）

### インフラ

- Vercel の関数リージョンは **東京 `hnd1`** 固定（`vercel.json`）。Supabase と同じリージョンに置くため。変更しない
- Supabase は **GOOD ORDER と同じ組織に作った LOOP 専用プロジェクト**。
  洋輔さんの実動版 `jqvyepvjxnkpirusesxg` ではない
- Sentry は **LOOP 専用プロジェクト**。通知先は Slack の `#goodloop_monitoring`

### Supabase — マルチテナント

**1つのデータベースに全クライアント（＝店舗）のデータが同居します。分離は行単位で行います。**

- 店舗に属するテーブルには必ず **`tenant_id` 列**を置く。列名はこれで固定（表記ゆれを許さない）
- そのテーブルで必ず **RLS（行レベルセキュリティ）を有効化する**。
  列があっても RLS が無ければ行は分離されない。対で必須
- これは `npm run tenant` が機械的に検出する（`scripts/check-tenant.mjs`）。
  全テナント共通のマスタ表など、店舗に属さないテーブルだけは、`CREATE TABLE` の直前のコメント行に
  `-- tenant-check-allow: 理由` と書いて除外できる。**理由は必ず書く**
- SQL は `supabase/` 配下に**1機能1ファイル**で追加する。既存ファイルを書き換えない
- **RLSを緩めない。** 緩める必要が出たら、それは設計の問題。天真に相談する

### デザイントークン

- `app/design-tokens.css` が実装側の参照先。**source of truth は Figma Variables**
  （変数コレクション `Loop Theme` ＝9モード）。Figma で値が変わったらこのファイルを同期する

**`Loop Theme` の所在（2026-08-04 時点。Figma Plugin API `getLocalVariableCollectionsAsync` で実測）**

| 項目 | 値 |
|---|---|
| ファイル | **`i7z9wGL6BpFoC2kwlGA1lV`（GOOD LOOP 専用ファイル）** |
| コレクション ID | `VariableCollectionId:29:812` |
| コレクション key | `704fe2858d736c9a125b703d0c58a53ff0737812` |
| モード（9業態） | Clinic / Restaurant / Salon / Beauty / Seikotsuin / Fitness / School / Pet / Lodging/Sauna |
| 変数（8） | `accent/primary` `accent/light` `accent/action` `accent/wash` `accent/on-primary` `cta/primary` `cta/action` `cta/on-primary` |

> **同日中に UTUTU から LOOP 専用ファイルへ移設された。値は72個とも変わっていない。**
> UTUTU 側の `Loop Theme` は削除済み。UTUTU に残っているのは
> `Spacing` / `Radius` / `Size` / `Color` / `Brand Core` / `Brand Product` の6コレクション。

**ファイルの役割分担（2026-08-04 に決定）**

| ファイル | 役割 |
|---|---|
| `KGPuY4YVRQW6BMRrulBaFN`（UTUTU） | **共通ライブラリ。** 色・余白・角丸・サイズ・文字・共通コンポーネント。ライブラリとして公開する |
| `i7z9wGL6BpFoC2kwlGA1lV`（GOOD LOOP） | **LOOP のデザイン実体 ＋ LOOP専用トークン（`Loop Theme`）** |

GOOD ORDER も他サービスも同じ形にする（基本＝UTUTU、専用＝各プロダクトのファイル）。

- **CSS変数名には必ず `--loop-` の接頭辞を付ける。**
  UTUTU の `Brand Product` 側が `product/accent-primary` 等に改名されたため、
  **名前の衝突はもう起きない。** それでも接頭辞を付けるのは、
  **LOOP専用トークンと、将来 UTUTU から読み込む共通トークンを CSS上で見分けるため。**
  - 例: `--loop-accent-primary`（LOOP専用） / `--product-accent-primary`（UTUTU 由来）
- **業態別テーマはモード切替で成立させる。** 9業態それぞれに別の実装を書かない。
  CSS変数の値が差し替わるだけで全画面の色が変わる構造を壊さないこと
- 新規JSXでは `p-[var(--space-16)]` `rounded-[var(--radius-xl)]` のような任意値記法、
  または `style={{ }}` で CSS変数を直接参照する。
  これらは Tailwind のデフォルトと同名で値が違うため、**`tailwind.config.ts` には意図的にマージしていない**
- **生の色コードを直接書かない。**
- これは **`npm run design` が機械的に検出する**（`scripts/check-design-tokens.mjs`）。
  - トークンに無い色 → デザイン判断が必要。**勝手に決めず天真に確認する**（上記 3 参照）
  - トークンと同値の直書き → `var(--...)` に置き換える
  - SVG は属性に `var()` を書いても解決されない。
    `<svg style={{ color: "var(--...)" }}>` ＋ `stroke="currentColor"` の形にする
  - PWA の meta や QR 生成など、**構造的に CSS変数が使えない**箇所だけ、
    その行か直前のコメントに `design-qa-allow: 理由` と書いて除外する。理由は必ず書く

### Figma

- ファイルキーは **`i7z9wGL6BpFoC2kwlGA1lV`**（GOOD LOOP 専用ファイル）
- **検品対象はこのファイルの全ページ**（`scripts/check-figma.mjs` の `SKIP_PAGES` を除く）。
  ファイルの中身がすべて LOOP のものなので**除外リスト方式**にしてある。
  新しくページを作ったら、登録しなくても自動で検品の対象に入る
- `SCREEN_PAGES` は「全セクションに PC / SP の対を要求するページ」＝画面制作のページ。
  `App Design Master` と `Web Design Master`。`Components` は画面ではないので入れない
- `PAIR_EXEMPT_SECTIONS` は「SP しか作らないセクション」＝来店客側の画面。
  対を免除するかわりに**SP 扱いになり、タップ領域44px以上の検査対象になる**
- 設定に書いたページ名・セクション名が Figma に実在しないと、検品はエラーで落ちる。
  名前を変えたときに「見ているつもりで見ていない」状態にならないための仕掛け
- 検品は `npm run design:figma`。判定基準は `docs/specs/design-rules.md`
- `scripts/figma-check-baseline.json` は「既存分として見逃す違反」の一覧。
  ここを増やすのは、返済されない負債を増やすということ。
  検品が落ちたときに `--update-baseline` へ逃げないこと
- **⚠ 現行トークンには `file_variables:read` スコープがありません。**
  そのため Variables API（`/v1/files/:key/variables/local`）は 403 で落ちます。
  プランの制限ではなく**スコープの不足**です（`Invalid scope(s): file_content:read.`）。
  変数の値を機械的に取りたい場合は、`file_content:read` ＋ `file_variables:read` の
  2スコープでトークンを発行し直すこと。**発行し直したら GitHub のシークレットも更新する**
  （`~/.zshrc` だけ直すと CI 側が古いトークンのままになる）
- **⚠ Figma のパーソナルアクセストークンの有効期限は 2026-11-01 です。**
  切れると `npm run design:figma` が **403** で落ちます。スクリプトのバグではありません。
  Figma で発行し直して `~/.zshrc` の `export FIGMA_TOKEN="figd_..."` を更新してください。
  トークンは**リポジトリに置かない**（`npm run secrets` が落とします）

### UI の実装

- **HTMLアウトプットは白ベース（ライトモード）固定。ダークモードは実装しない**
- 来店客側はスマホが主。**SP を先に考える**
- トグル・チェック等の即時フィードバックが要る操作は**楽観的更新**で実装する。
  ローカル状態を先に更新 → 永続化 → **失敗したときだけロールバック**
- 同期的な `await action()` → `router.refresh()` パターンは**使わない**。
  画面全体の再フェッチは体感が重く、操作の手触りが死ぬ

---

## 5. ブランド・表記規約

- プロダクト名称は **GOODシリーズ** で統一（**GOOD LOOP** / **GOOD ORDER**）
- 提供元は **株式会社UTUTU**
- ビジネスパートナーは **洋輔（板倉洋輔）**。資料・文書では必ず**洋輔を先に表記**する（「洋輔 × 天真」の順）

---

## 6. ディレクトリの読み方

| パス | 役割 |
|---|---|
| `app/` | App Router。ルートごとに `layout.tsx` でメタデータを定義 |
| `components/` | 共通コンポーネント |
| `lib/` | ロジック・Supabaseクライアント |
| `supabase/` | SQLマイグレーション。1機能1ファイル。`tenant_id` ＋ RLS が必須 |
| `scripts/` | 検品スクリプト。`npm run check` から呼ばれる |
| `.claude/` | Claude Code の設定と hooks。`require-check.sh` が完了を機構で縛る |
| `.github/workflows/` | GitHub Actions。`check.yml` が PR と main で `npm run check` を回す |
| `docs/specs/` | 仕様。**実装前に該当ファイルを読む** |
| `docs/handoff.md` | 実装の経緯と判断の履歴。**セッション開始時に読む** |

---

## 7. やってはいけないこと

- `.env.local` をコミットする（**public リポジトリ**）
- `npm run check` を通さずに完了を宣言する
- `tenant_id` の無いテーブル、RLS を有効化していないテーブルを作る
- `scripts/figma-check-baseline.json` に逃げる（`--update-baseline` で違反を握り潰す）
- 洋輔さんの実動版（Netlify / Supabase `jqvyepvjxnkpirusesxg`）に触る
- `node_modules/` `.next/` `tsconfig.tsbuildinfo` を手で編集する
- Dropbox の同期競合コピー（`*競合コピー*`）をコミットする

---

## 8. ブランチとコミットの規約

### ブランチ

- **`main` への直接 push は禁止**。GitHub のブランチ保護で機構的に不可能（管理者にも適用済み）
- 作業は必ず feature ブランチを切り、**PR 経由で `main` に入れる**
- ブランチ名は `種別/短い説明`。種別は `feat` / `fix` / `refactor` / `docs` / `chore` / `ci`
  例: `feat/survey-rating-branch`

### コミット

- **Conventional Commits ＋ 日本語**。例: `feat(survey): 5段階評価の分岐を追加`
- **各コミットは、それ単体で `npm run check` が通る状態にする**。
  意味の単位ではなく「通る単位」で割る

### PR とマージ

作業が完了したら、AI は次のところまで**自分で実行する**。手順は以下。

1. `git checkout -b 種別/説明`
2. 実装 → `npm run check` が通るまで自分で直す
3. コミット（説明文は日本語。Conventional Commits）
4. `git push -u origin <ブランチ名>`
5. `gh pr create` で PR を作成する。**`--fill` は使わない。** 本文には必ず以下の3項目を書く。
   - 変更内容（箇条書き、1行ずつ）
   - プレビューで見てほしいページのパス
   - PC 1400px / SP 390px のスクリーンショット
6. **ここで止まる。AI は `gh pr merge` を実行しない。**

- マージの判断は天真が行う。天真がプレビューを見て問題なければ、天真自身がマージする
- **マージは squash のみ。** `main` の履歴は一直線に保つ
- **CI（GitHub Actions の `check`）が落ちたら、報告せずに自分で直す。**
  ローカルの Stop hook とまったく同じ扱い（上記 2 を参照）

### 例外

- 上記 3 の「止まって確認する」項目を含む変更は、**PR を作るところまでで止めて**
  天真に確認を取る（通常フローと同じく、AI はここでも `gh pr merge` を実行しない）
- **`gh pr merge`、`gh pr merge --admin`、およびブランチ保護の一時解除は、AI は絶対に使わない。**
  マージは天真だけが行う
