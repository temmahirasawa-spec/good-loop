# AI視認性チェッカー — 実装計画

飲食店オーナーが自店名を入れると、実際にAIへ現実的な質問を投げ、自店が推薦されるかを
計測してスコア・判定・改善レポートで返す無料診断ツール。**GOOD REVIEW のリード獲得の入口**。

- 公開パス: **`/ai-check`**（2026-08-17 天真決定）
- 結果は **Supabase に保存する**（同上）
- 参照プロトタイプ: `docs/prototypes/ai-visibility-checker.html`（701行・git未追跡）
- 配色は **既存デザイントークンだけで作る**（案①。新規トークンは足さない。同上）
- プロダクト名は **GOOD REVIEW**（GOOD REVIEW からの改名は正式決定。同上）

> **この文書は計画であり、着手の合意ではありません。**
> 末尾「9. 判断が必要な点」に、着手前に天真の返事が要る項目を並べています。

---

## 1. プロトタイプの読解結果

### 1-1. 動いている仕組み（そのまま活かすもの）

| 要素 | プロトタイプの実装 | 本番での扱い |
|---|---|---|
| 質問の作り方 | `エリア＋ジャンル おすすめ` / `エリアで人気のジャンルを教えて` / `エリア ジャンル 隠れた名店` の3問 | **そのまま**（`lib/ai-check/questions.ts` に移す） |
| 1問の処理 | ① Claude に web検索付きで質問 → ② 別のClaude呼び出しで「その回答に自店が出たか」をJSON判定 | **そのまま2段構え**（サーバー側に移す） |
| 判定の保険 | JSON判定が失敗したら、記号を除去した文字列一致で `mentioned` だけ出す | **そのまま**（`fallbackJudge`） |
| スコア | `登場率 × 78 ＋ 順位ボーナス 最大22`（0–100に丸め） | **そのまま**（`lib/ai-check/score.ts`） |
| 判定ランク | S≥85 / A≥70 / B≥50 / C≥30 / D | **そのまま** |
| 競合集計 | 全問の回答に出た店名を数えて上位6件（自店は除外） | **そのまま** |
| 免責 | フッターに「計測時点のスナップショット／掲載を保証しない」 | **必須。文言は天真確認** |

### 1-2. 本番用に作り直すもの（天真の指示どおり）

| 論点 | プロトタイプ | 本番 |
|---|---|---|
| API呼び出し | ブラウザから `https://api.anthropic.com/v1/messages` を直叩き（claude.ai プレビュー内でのみ動く） | **Route Handler（サーバー）に移す。ブラウザは自前APIだけを叩く** |
| APIキー | 存在しない | `ANTHROPIC_API_KEY`（既に `.env.local` に設定済み）。`NEXT_PUBLIC_` を付けない |
| 永続化 | なし | Supabase に セッション／質問結果／リードを保存 |
| メール送信ボタン | 「動作のデモです」で何もしない | **保存はする。送信はしない**（Resend の鍵が未取得のため。フェーズ5の宿題） |

### 1-3. プロトタイプに含まれていて、本番では**実測できない**もの

**「要因分析」（03 · Why）は、サンプルデータ専用でした。** 実測モード（`runLive`）では
`factors: null` になり、「フルレポート（無料）でお送りします」という案内カードに差し替わります。

要因分析の6項目のうち、GOOD REVIEW が機械的に取れるものは限られます。

| 要因 | 取得可否 |
|---|---|
| 直近90日の新規クチコミ | ✗ Places API は `userRatingCount`（総数）と直近5件しか返さない |
| オーナー返信率 | ✗ API では取得できない |
| 基本情報の鮮度 | △ 営業時間の有無は取れるが「古いか」は判定できない |
| 写真の量と質 | △ 枚数は取れる。質は取れない |
| 公式サイトの構造化データ | ○ サイトURLを取得して JSON-LD を読めば取れる |
| 第三者メディアでの言及 | △ web検索の回数で近似はできる |

**→ β版は「要因分析はフルレポートでお送りします」の案内カードのままにすることを推奨します。**
実測できないものを数値で出すと、それは診断ではなく作り話になります（→ 9-1）。

---

## 2. ファイル構成（新規作成するもの）

既存の規約（`CLAUDE.md` 6章、機能領域ごとにディレクトリを切る）に合わせます。

### ページ

| パス | 役割 |
|---|---|
| `app/ai-check/page.tsx` | Server Component。`metadata` を定義し、`data-loop-theme` を付けた器を置いて `AiCheckFlow` を描画するだけ |

`layout.tsx` は作りません（ルートレイアウトのフォント・viewport をそのまま使う）。

### コンポーネント（`components/ai-check/`）

| ファイル | 役割 |
|---|---|
| `AiCheckFlow.tsx` | `"use client"`。3画面の状態機械（`input` → `checking` → `report`）。API呼び出しの起点 |
| `InputScreen.tsx` | 入力画面（ヒーロー＋フォーム＋「3ステップ」カード） |
| `CheckingScreen.tsx` | 診断中画面（プログレスバー＋質問行のリスト＋失敗バナー） |
| `QuestionProgressRow.tsx` | 質問1行（待機中／質問中／照合中／✓／✗／—）※ 名前は `rating-flow/CheckRow.tsx` との衝突を避けた |
| `ReportScreen.tsx` | レポート画面の組み立て |
| `VerdictCard.tsx` | スコア・判定スタンプ・リング |
| `ScoreRing.tsx` | SVGの円グラフ（`currentColor` で塗る。SVG属性に `var()` は効かないため — CLAUDE.md 4章） |
| `QuestionResultCard.tsx` | 質問別の結果カード（抜粋・店名チップ・自店ハイライト） |
| `CompetitorList.tsx` | 「AIが代わりに推薦しているお店」の横棒リスト |
| `FullReportNotice.tsx` | 要因分析の代わりに出す案内カード（→ 1-3） |
| `LeadForm.tsx` | メールアドレス取得フォーム |
| `AiCheckHeader.tsx` / `AiCheckFooter.tsx` | ワードマーク・βバッジ・免責 |
| `icons.tsx` | このページ専用のアイコン |
| `Toast.tsx` | 入力エラー等の通知 |

### ロジック（`lib/ai-check/`）

| ファイル | 役割 |
|---|---|
| `types.ts` | セッション・質問結果・レポートの型。API の Request/Response 型もここ |
| `questions.ts` | エリア×ジャンルから3問を組み立てる |
| `ask.ts` | `server-only`。Anthropic に web検索付きで質問する |
| `judge.ts` | `server-only`。回答から自店の言及を構造化出力で判定する／失敗時のフォールバック |
| `match.ts` | 表記ゆれ正規化（`norm`）・自店判定（`isTarget`）・競合集計 |
| `score.ts` | `calcScore` / `rankOf` |
| `summary.ts` | 総評テキストの組み立て（テンプレート。AI生成ではない） |
| `repository.ts` | `server-only`。Supabase の読み書きをここに閉じる |
| `rate-limit.ts` | `server-only`。IPハッシュ化と回数制限 |

### API（Route Handler）

| パス | 役割 |
|---|---|
| `app/api/ai-check/sessions/route.ts` | セッションを作り、質問文を返す（レート制限もここ） |
| `app/api/ai-check/questions/route.ts` | 1問だけ実行して結果を返す・保存する |
| `app/api/ai-check/finalize/route.ts` | 保存済みの結果からスコア・総評を確定してレポートを返す |
| `app/api/ai-check/leads/route.ts` | メールアドレスを保存する |

### SQL・仕様書

| パス | 役割 |
|---|---|
| `supabase/0008_ai_check.sql` | テーブル3つ（1機能1ファイル。既存を書き換えない） |
| `docs/specs/ai-check.md` | 画面遷移・状態一覧・文言。**実装前に書いて天真の合意を取る**（design-rules 1-1） |

### 既存ファイルへの変更（3件だけ）

| ファイル | 変更 |
|---|---|
| `.env.local.example` | `AI_CHECK_IP_SALT` をプレースホルダで追加 |
| `docs/legal/privacy.md` | メールアドレス・アクセス情報の取得目的を追記（→ 9-7。**天真確認が必要**） |
| `app/layout.tsx` | Barlow に `700` を足す場合のみ（→ 9-4） |

---

## 3. 既存コンポーネントの再利用可否

### そのまま再利用できるもの — **ありません**

理由をはっきり書きます。既存の共通コンポーネントは**すべて Figma のノード番号に紐づいた
GOOD REVIEW の管理画面・来店客画面専用**で、propsに汎用性がありません。

| 既存 | 使えない理由 |
|---|---|
| `LoopButton` | variant が `primary` / `copy` / `google` / `regenerate` の4択。文言まで固定（「Googleマップを開く」等） |
| `LoopInput` | ラベル・必須表示を持たない。高さ48px固定（プロトタイプは50px。スケール上は52px） |
| `TagChip` / `CheckRow` | 選択トグル用。結果表示には使えない |
| `KpiCard` | 「前週比」前提の構造 |
| `ProgressBar` | **2ステップ固定**（`step: 1 | 2`）。診断中の進捗（0–100%）には使えない |
| `AiBadge` | props が `label` だけなので**使えます**が、`--loop-accent-wash` 前提の見た目がレポートの雰囲気と合うかは要確認 |

### 方針：`components/ai-check/` に閉じた自前実装にする

- 既存コンポーネントを**改造しない**（管理画面・来店客画面に影響が出るため）
- 既存に無いものを作るときは申告する、という design-rules 2-3 の趣旨に沿って、ここで申告します
- ただし**トークンは100%既存のものを使う**ので、色・余白・角丸の秩序は共有されます

### 例外的に再利用するもの

| 既存 | 使い方 |
|---|---|
| `AiBadge`（`components/rating-flow/AiBadge.tsx`） | レポート内の「Claude 実測」表示に流用を検討。**AI生成物の開示は規約上必須**（CLAUDE.md 4章の趣旨） |
| `lib/supabase/admin.ts` | 来店客と同じく「ログインしない利用者」なので `createSupabaseAdminClient()` を使う |
| `lib/rating-flow/generate-draft.ts` の**書き方** | タイムアウト・フォールバック・ログ保存の型をそのまま踏襲する（コードは共有しない） |

---

## 4. スタイルの置き換え対応表

プロトタイプの `:root` 変数 → 既存トークン。**新しいトークンは1つも足しません。**

### 色

| プロトタイプ | 値 | 置き換え先 | 備考 |
|---|---|---|---|
| `--paper` | `#FAF9F4` | `--product-color-bg-primary` (`#fafafa`) | 背景のドット模様は**廃止**（トークン外のグラデーションになるため） |
| `--card` | `#FFFFFF` | `--product-color-surface-white` | |
| `--ink` | `#17181C` | `--product-color-text-primary` (`#1a1a1a`) | |
| `--sub` | `#70747C` | `--product-color-text-secondary` (`#646464`) | |
| `--line` | `#E8E5DB` | `--product-color-border-default` (`#dddddd`) | |
| `--line-soft` | `#F0EDE4` | `--product-color-border-divider` (`#ededed`) | |
| `--accent` | `#FAC03D` | `--loop-accent-primary` | テーマ選択に依存（→ 9-3） |
| `--accent-soft` | `#FDEDC2` | `--loop-accent-wash` | |
| ボタンhover `#F5B520` | | `--loop-accent-action` | プロトタイプより**かなり濃い**。押下時の色として使う |
| `--good` / `--good-deep` / `--good-bg` / `--good-line`（ティール） | | `--loop-accent-primary` / `-action` / `-wash` / `-light` | **「登場した」＝アクセント色**で表す |
| `--bad` / `--bad-deep` / `--bad-bg` / `--bad-line`（レッド） | | `--product-color-text-tertiary` / `-secondary` / `--product-color-bg-secondary` / `--product-color-border-default` | **赤が既存トークンに無い。「登場せず」はグレーで表す**（→ 9-2） |
| `--warn` | `#E8A23D` | `--product-color-status-warning` (`#f59e0b`) | 取得失敗・注意表示 |
| CTAの背景グラデーション `#FFFDF6→#FFF8E3` | | `--loop-accent-wash` のベタ塗り | グラデーションは廃止 |
| CTA枠線 `#F1DFAC` | | `--loop-accent-light` | |
| ハイライト `mark.me` の下線 | `--accent` | `--loop-accent-light` の背景ベタ | グラデーション疑似下線は廃止 |

### 角丸・サイズ

| プロトタイプ | 置き換え先 |
|---|---|
| `16px`（カード） | `--product-radius-lg` (16px) — **一致** |
| `14px` / `12px` / `11px`（小カード・ボタン・入力欄） | `--product-radius-md` (12px) に**統一** |
| `999px`（ピル・バー） | `--product-radius-full` (999px) — 一致 |
| ボタン高さ `padding:14px 22px` → 実測約51px | `--product-control-h-lg` (52px) |
| 入力欄 `height:50px` | `--product-control-h-lg` (52px) |
| タップ領域 | すべて `--product-touch-min` (44px) 以上を担保 |

### 余白

プロトタイプは `22px` `26px` `15px` `10px` `9px` など**スケール外の値**を多用しています。
`docs/specs/design-rules.md` 2-5 のスケール `2,4,8,12,16,20,24,32,40,48,64,80,96,112,128` に丸めます。

| プロトタイプ | → |
|---|---|
| 9 / 10 / 11 | **8** または **12** |
| 14 / 15 | **16** |
| 18 / 19 | **20** |
| 22 | **24** |
| 26 | **24** |
| 34 / 44 | **32** / **48** |

### タイポグラフィ

| プロトタイプ | 置き換え先 |
|---|---|
| `Noto Sans JP` 400/500/700 | 既存の `--font-noto-sans-jp`（**500 と 700 のみ**読み込み済み）。本文は500 |
| `Barlow` 500/600/700（`.eyebrow` `.wordmark`） | `--font-barlow`（**600のみ**読み込み済み） |
| `Barlow Condensed` 600/700（大きい数字） | **未読み込み。`--font-barlow` で代用する**（→ 9-4） |
| `font-size: clamp(76px,21vw,116px)`（スコア） | `clamp()` は維持（レスポンシブに必要）。値はそのまま |

### 検品との関係

- `npm run design` は **`.ts` / `.tsx` のみ**を走査します。CSSファイルに生の色を書けば検品は通りますが、**それは規約の趣旨に反するので絶対にやりません**
- 例外が必要な箇所（あれば）は行内に `design-qa-allow: 理由` を書く

---

## 5. データフローと状態管理

### 全体の流れ

```
[入力画面]
  ↓ 「実測でチェックする」
POST /api/ai-check/sessions   … セッション作成＋質問3問を受け取る（即時。1秒以内）
  ↓
[診断中画面] 3問を並列で走らせる
POST /api/ai-check/questions {index:0}  ┐
POST /api/ai-check/questions {index:1}  ├─ それぞれ 30〜90秒。返ってきた順に行が確定する
POST /api/ai-check/questions {index:2}  ┘
  ↓ 全問が終わったら
POST /api/ai-check/finalize   … サーバーがスコア・総評を確定して返す
  ↓
[レポート画面]
  ↓ メール入力
POST /api/ai-check/leads
```

### なぜ「1問1リクエスト」にするのか

診断中画面は「質問ごとに 質問中 → 照合中 → 結果 が1行ずつ確定していく」必要があります。
やり方は3つあり、**案Aを推奨**します。

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | 1問＝1リクエスト。3本を並列で投げ、返った順に行を確定 | ストリーミング不要。既存のRoute Handlerの書き方（素のJSON）をそのまま使える。1リクエストが短く保たれるので Vercel のタイムアウトに余裕。**コスト上限も1リクエスト単位でかけられる** |
| B | 1本のリクエストで SSE / ReadableStream を返し、進捗を流す | リクエストは1本で済むが、このリポジトリにストリーミングの実装例が無く、書き方の前例を作ることになる |
| C | ジョブをDBに作って、クライアントがポーリング | 実装量が一番多い。3問には過剰 |

案Aの弱点は「HTTPリクエストが増える」ことですが、3本なのでブラウザの同時接続上限（同一ホスト6本）に
収まります。

### 状態管理

- `AiCheckFlow.tsx` に `useReducer` を1つ置くだけ。状態ライブラリは入れない
- 状態の形：`{ phase, input, sessionId, rows[], report, error }`
- **行の見た目は「サーバーの返事を待たずにローカルで先に進める」**（規約の楽観的更新）
  - リクエストを投げた瞬間 → `質問中`
  - （照合中は、サーバーからの中間通知が無いため、経過時間で切り替える擬似表示にする）
  - レスポンスが返ったら → `✓` / `✗` / `—`
- **`router.refresh()` は使わない**（規約）。レポートはAPIの戻り値をそのまま state に入れる
- URL に `sessionId` を載せない（再訪・共有は初回スコープ外）
- `prefers-reduced-motion: reduce` を尊重（カウントアップ・リング・スタンプを止める）

### サーバー側の1問の処理

```
① セッションと質問indexを検証（存在するか・まだ実行していないか）
② Anthropic：web検索付きで「エリア×ジャンルのおすすめ店」を質問
   → pause_turn が返ったら会話を継ぎ足して再送（web検索は10往復で一旦停止するため）
③ Anthropic：①の回答テキストから自店の言及を構造化出力で判定
   → 失敗したら文字列一致のフォールバック
④ ai_check_questions に UPDATE（結果・レイテンシ・検索回数）
⑤ クライアントに返す
```

タイムアウト・失敗時は `status='error'` で保存し、行は `—`（取得できませんでした）にする。
**全問が失敗したときだけ**、プロトタイプと同じ失敗バナーを出して入力画面に戻れるようにする。

---

## 6. API 設計

すべて `POST`。既存の流儀（`app/api/rating-flow/responses/route.ts`）に合わせます。

- `NextResponse.json()` を使う。`NextRequest` は使わない
- `await request.json().catch(() => null)` で必ず握る
- バリデーションは**手書きの型ガード**（Zod は入れない。既存にも入っていない）
- エラーは一律 `{ error: "英小文字のメッセージ" }` ＋ ステータスコード。例外を throw しない
- 冒頭に日本語のJSDocで「どの仕様のどこに対応するか」を書く
- `export const maxDuration = 300`（`/questions` のみ。Vercel の関数上限は300秒）
- リージョンは `vercel.json` の `hnd1` のまま（変更しない）

### 6-1. `POST /api/ai-check/sessions`

```ts
type CreateSessionRequest = {
  storeName: string;   // 必須・1〜100文字
  area: string;        // 任意・0〜50文字（空なら既定値）
  genre: string;       // 任意・0〜50文字（空なら既定値）
};

type CreateSessionResponse = {
  sessionId: string;
  questions: { index: number; text: string; engine: "Claude" }[];  // 3件
};
```

| 状況 | 返す |
|---|---|
| body が不正・店名が空 | `400 { error: "invalid request body" }` |
| 同一IPから短時間に作りすぎ | `429 { error: "too many requests" }` |
| 保存に失敗 | `500 { error: "failed to create session" }` |

### 6-2. `POST /api/ai-check/questions`

```ts
type RunQuestionRequest = { sessionId: string; index: number };  // index は 0|1|2

type QuestionResult = {
  index: number;
  question: string;
  engine: "Claude";
  status: "done" | "error";
  mentioned: boolean;
  position: number | null;      // 回答リスト内の順位
  matchedText: string | null;   // 実際に一致した表記（ハイライト用）
  stores: string[];             // 回答に登場した店名（順番どおり・最大8件）
  excerpt: string;              // 回答の抜粋（最大280文字）
};
```

レスポンスは `QuestionResult` そのもの。

| 状況 | 返す |
|---|---|
| body が不正 / index が範囲外 | `400 { error: "invalid request body" }` |
| セッションが無い | `404 { error: "session not found" }` |
| **その質問が既に実行済み** | `200`（保存済みの結果をそのまま返す。**再課金しない**） |
| Anthropic 呼び出しが失敗 | `200 { status: "error", ... }`（画面は止めない。500 にはしない） |
| DB書き込みに失敗 | `500 { error: "failed to save result" }` |

### 6-3. `POST /api/ai-check/finalize`

```ts
type FinalizeRequest = { sessionId: string };

type FinalizeResponse = {
  store: string; area: string; genre: string;
  checkedAt: string;                                  // ISO8601
  score: number;                                      // 0-100
  rank: "S" | "A" | "B" | "C" | "D";
  rankLabel: string;                                  // 「AIから十分見えています」等
  hitCount: number; validCount: number; errorCount: number;
  questions: QuestionResult[];
  competitors: { name: string; count: number }[];     // 上位6件
  summary: string;
};
```

**スコア・ランク・総評はサーバーで計算します**（クライアントでは計算しない）。
理由：保存する値と表示する値を一致させるため。

| 状況 | 返す |
|---|---|
| セッションが無い | `404 { error: "session not found" }` |
| 全問が未実行 | `409 { error: "no completed questions" }` |
| 保存に失敗 | `500 { error: "failed to finalize session" }` |

### 6-4. `POST /api/ai-check/leads`

```ts
type LeadRequest = { sessionId: string; email: string };
type LeadResponse = { ok: true };
```

| 状況 | 返す |
|---|---|
| メール形式が不正 | `400 { error: "invalid email" }` |
| セッションが無い | `404 { error: "session not found" }` |
| 同じセッションで登録済み | `409 { error: "already submitted" }` |
| 保存に失敗 | `500 { error: "failed to save lead" }` |

**メール送信はしません**（Resend の鍵が未取得 — `docs/setup-tasks.md` 4）。保存のみ。
画面には「担当者からお送りします」等、送信タイミングを約束しない文言にする（→ 9-10）。

---

## 7. Supabase のテーブル設計

`supabase/0008_ai_check.sql`（1機能1ファイル。既存ファイルは触らない）。

### 7-1. マルチテナントの扱い — **`tenant-check-allow` を使います**

`CLAUDE.md` 4章は「店舗に属するテーブルには必ず `tenant_id` ＋ RLS」ですが、
**このツールのデータは店舗（テナント）に属しません。** 契約前の見込み客のデータであり、
持ち主は株式会社UTUTU です。したがって `CREATE TABLE` の直前に理由付きの除外コメントを書きます。

```sql
-- tenant-check-allow: 契約前の見込み客の診断ログ。特定のテナント（店舗）に属さない
```

**ただし RLS は自主的に有効化し、ポリシーを1つも作りません。**
`anon` / `authenticated` には `GRANT` も与えません（`supabase/0003_grants.sql` と同じ考え方）。
結果として **`SUPABASE_SERVICE_ROLE_KEY` を持つサーバー側からしか読み書きできません。**
リードのメールアドレスは個人情報なので、これは必須です。

> 記憶にある注意点：RLS有効・ポリシー無しのテーブルは、エラーではなく**黙って0件**を返します。
> 管理画面から見えないのはバグではなく設計です。

### 7-2. テーブル

**`ai_check_sessions`** — 1回の診断

| 列 | 型 | 備考 |
|---|---|---|
| `id` | uuid pk | |
| `store_name` | text not null | 入力された店名 |
| `area` / `genre` | text | 入力されたエリア・ジャンル |
| `status` | text check (`running`/`completed`/`failed`) | |
| `question_count` | int not null default 3 | |
| `hit_count` | int | finalize 時に確定 |
| `score` | int | 同上 |
| `rank` | text check (`S`/`A`/`B`/`C`/`D`) | 同上 |
| `summary` | text | 同上 |
| `ip_hash` | text | **生IPは保存しない。** `sha256(ip + AI_CHECK_IP_SALT)` |
| `user_agent` | text | |
| `created_at` / `completed_at` | timestamptz | |

インデックス: `(ip_hash, created_at)` … レート制限の照会用

**`ai_check_questions`** — 質問1問の結果

| 列 | 型 | 備考 |
|---|---|---|
| `id` | uuid pk | |
| `session_id` | uuid not null references `ai_check_sessions(id)` on delete cascade | |
| `idx` | int not null | 0/1/2 |
| `question` | text not null | |
| `engine` | text not null default `'Claude'` | β版はClaudeのみ。将来ChatGPT/Geminiを足すための列 |
| `model` | text | 実際に使ったモデルID |
| `status` | text check (`pending`/`done`/`error`) | |
| `mentioned` | boolean | |
| `position` | int | |
| `matched_text` | text | |
| `stores` | jsonb | 回答に出た店名の配列 |
| `excerpt` | text | |
| `latency_ms` | int / `search_count` int | |
| `error_message` | text | |
| `created_at` / `completed_at` | timestamptz | |

**`unique (session_id, idx)`** … これが**コスト上限の要**です。1セッションで同じ質問を
2回課金することが構造的にできなくなります。

**`ai_check_leads`** — リード

| 列 | 型 | 備考 |
|---|---|---|
| `id` | uuid pk | |
| `session_id` | uuid not null references … on delete cascade | |
| `email` | text not null | |
| `created_at` | timestamptz | |

**`unique (session_id)`** … 1診断につき1件。

### 7-3. 将来の拡張（今は入れない）

契約に至ったリードをテナントに紐づける必要が出たら、そのとき `tenant_id` 列を足す
マイグレーションを別ファイルで作ります。**先回りして列だけ作ることはしません。**

---

## 8. 実装の順序（フェーズ分け）

各フェーズの終わりに `npm run check` を通します。フェーズ1以降は1フェーズ＝1コミット相当。

| # | 内容 | 成果物 | 天真の関与 |
|---|---|---|---|
| **0** | **仕様を文章で書いて合意する** — 画面遷移・状態一覧（通常/空/失敗/ローディング）・全文言・プロンプト2本・テーマ色・モデル選択 | `docs/specs/ai-check.md` | **確認必須。ここで止まる** |
| 1 | DB＋API骨格。Anthropic は呼ばず固定データで3画面が最後まで通る状態にする | `supabase/0008_ai_check.sql`、API4本、`lib/ai-check/` のうちAI以外 | 不要 |
| 2 | Anthropic 実配線。web検索・構造化出力・`pause_turn`・タイムアウト・フォールバック・ログ | `ask.ts` / `judge.ts` | **実測コストの報告** |
| 3 | 画面3枚を作る。**SPを先に作ってからPCに広げる**。トークン置き換え表どおりに実装 | `components/ai-check/` 一式 | **スクショ提示（PC1400/SP390）** |
| 4 | レート制限・リード保存・プライバシーポリシー改定 | `rate-limit.ts`、`docs/legal/privacy.md` | **プライバシーポリシーの確認必須** |
| 5 | 検品・スクショギャラリー・PR作成 | PR | **マージ判断** |

**Figma への反映は別セッションで後追いします。** 理由：この機能は Figma に対応ノードが無く、
プロトタイプHTMLが事実上のデザイン原本だからです。ただし `npm run design:figma` の検品対象は
「全ページ」なので、Figma に何も足さない限り検品は落ちません（→ 9-13）。

---

## 9. 懸念点・判断が必要な点

**着手前に返事がほしいもの（9-1 〜 9-5）と、フェーズの途中で返事がほしいもの（9-6 以降）に
分けています。**

### 9-1. 要因分析をどうするか ★着手前

**何が起きているか：** プロトタイプの「要因分析」（口コミ件数34点、返信率18点…）は
**サンプル用の架空データ**で、実測モードでは表示されません（1-3参照）。実測できるのは
6項目中1〜2項目です。

**選択肢**

1. **（推奨）β版は「要因分析はフルレポートでお送りします」の案内カードにする** — プロトタイプの実測モードと同じ。作り話をしない
2. 実測できる項目（構造化データの有無など）だけ2項目出す — 誠実だが、6項目→2項目で見栄えが落ちる
3. Places API を足して近似値を出す — 実装が1フェーズ増える。返信率は結局取れない

**やらなかった場合：** 案内カードのままなので、レポートの情報量は減りますが誤情報は出ません。
**取り消せるか：** はい。後から項目を足せます。

### 9-2. 「登場せず」を何色で出すか ★着手前

**何が起きているか：** プロトタイプは ✓ を緑（`#2FBFB4`）、✗ を赤（`#E5605A`）で出しています。
**既存トークンに緑（アクセント以外）も赤もありません。** 案①（既存トークンのみ）を選ばれたので、
以下になります。

- ✓ 登場した → **アクセント色**（テーマの主色）
- ✗ 登場せず → **グレー**（`--product-color-text-tertiary`）

**やらなかった場合（＝赤を使いたい場合）：** Figma の `Loop Theme` に success / danger の
トークンを足す作業が先に必要になります（案②）。1〜2時間の Figma 作業＋同期です。

**取り消せるか：** はい。後からトークンを足して差し替えられます。

### 9-3. `/ai-check` をどの色テーマで出すか ★着手前

`--loop-accent-*` は9業態のどれかを選ばないと値が決まりません。`/ai-check` は特定店舗の
ページではないので、ページ全体に固定値を1つ指定します。

| 案 | 値 | 主色 | 一言 |
|---|---|---|---|
| **1（推奨）** | `data-loop-theme="school"` | アンバー `#EFA71E` | プロトタイプの黄色 `#FAC03D` に最も近い |
| 2 | `data-loop-theme="restaurant"` | バーミリオン `#E0552B` | 対象が飲食店オーナーなので意味が通る。ただしプロトタイプよりかなり赤い |
| 3 | 指定なし（既定のclinic） | グリーン `#00C471` | 緑。診断ツールとしては清潔だがプロトタイプと別物になる |

**取り消せるか：** はい。`app/ai-check/page.tsx` の1行を変えるだけです。

### 9-4. 大きい数字のフォント ★着手前

プロトタイプはスコアの巨大数字に **Barlow Condensed**（未読み込み）を使っています。

| 案 | 内容 |
|---|---|
| **1（推奨）** | 既に読み込んでいる **Barlow 600** で代用する。追加読み込みゼロ |
| 2 | `app/layout.tsx` に Barlow の `700` を足す（同一ファミリなので追加転送量は小さい） |
| 3 | Barlow Condensed を新規に読み込む（フォントが1つ増える＝初回表示が少し重くなる） |

**やらなかった場合：** 案1でも成立します。数字がプロトタイプより少し幅広に見えます。

### 9-5. モデルと1回あたりのコスト ★着手前

**これは私が勝手に決めるべきではない項目です**（費用が発生するため）。

プロトタイプは `claude-sonnet-4-6` を使っていました。現行の選択肢：

| 案 | モデル | 単価（100万トークン） | 1診断の概算 | 一言 |
|---|---|---|---|---|
| 1 | Claude Opus 5 | 入力$5 / 出力$25 | **約 ¥45〜75** | 最も賢い。推薦文の現実味が高い |
| **2（推奨）** | Claude Sonnet 5 | 入力$3 / 出力$15（※2026-08-31まで $2/$10） | **約 ¥25〜45** | 品質と費用の釣り合いが良い |
| 3 | 質問はSonnet 5、判定はHaiku 4.5 | 判定は $1/$5 | **約 ¥20〜35** | 判定は単純作業なので落としても品質が落ちにくい |

- **web検索は別料金：1,000回で $10。** 1診断あたり最大9回検索 ＝ 約 ¥13
- **上の金額はすべて概算です（推測）。** 実測はフェーズ2で報告します
- 100人が診断すると **月2,500〜7,500円** 程度（推測）

**やらなかった場合：** 決めないと着手できません（コードにモデルIDを書く必要があるため）。

### 9-6. 無認証エンドポイントの乱用対策

`/api/ai-check/questions` は**ログイン不要でAnthropicに課金を発生させられる**エンドポイントです。
設計に3重の上限を入れます（実装するので確認は不要ですが、認識として共有します）。

1. `unique(session_id, idx)` — 1セッション＝最大3回のAI呼び出し。何度叩いても増えない
2. IPハッシュによるセッション作成の回数制限（**10分間に3セッションまで**を提案）
3. web検索の `max_uses` を3に固定

これで**1IPあたり10分で最大 ¥200 程度**（推測）に上限が掛かります。
将来さらに必要なら Vercel の BotID / WAF を検討します。

### 9-7. 個人情報 — プライバシーポリシーの改定が必要 ★フェーズ4で確認

メールアドレスを取得・保存するので、`docs/legal/privacy.md` と `/privacy` の改定が要ります。
これは **CLAUDE.md 3章「クライアントの目に触れる文言」「外部公開される内容」に該当**するので、
私は下書きを作って止まります。

- 取得する情報：メールアドレス、店名・エリア・ジャンル、**IPアドレスのハッシュ値**、ユーザーエージェント
- 利用目的：診断レポートの送付、サービスのご案内
- 生のIPアドレスは保存しません（ハッシュ化）

### 9-8. 実行時間とVercelの制限

- 1問 30〜90秒（web検索を伴うため）。3問を並列で 最長90秒
- Vercel の関数上限は 300秒（現行プランの既定）。`export const maxDuration = 300` を明示
- Anthropic SDK 側は `timeout` を **120秒**、`maxRetries: 0` に設定（既存 `generate-draft.ts` と同じ考え方。ただし秒数はこちらのほうが長い）
- **web検索は10往復で `pause_turn` を返して一旦止まります。** 会話を継ぎ足して再送する処理が必要です（最大2回まで、と上限を切ります）

### 9-9. GOOD REVIEW → GOOD REVIEW の改名スコープ ★着手前に方針だけ

改名が正式決定とのことですが、**この機能の実装で全体改名まで行うのは危険**です。影響範囲：

| 対象 | 内容 |
|---|---|
| CSS変数名 | `--loop-accent-*`（8個 × 9モード）→ 全ファイルの参照を書き換え |
| リポジトリ | `good-loop` / `package.json` の `name` |
| ドメイン | `app.good-review.jp`（`lib/site-url.ts`）。**QRコードに印字済みの値なので変えると既存の卓上POPが死にます** |
| Figma | ファイル名・`Loop Theme` コレクション名 |
| 規約文書 | `CLAUDE.md`・`README.md`・`docs/` 全般 |
| Supabase / Sentry / Slack | プロジェクト名・通知先 |

**推奨：** 今回作る `/ai-check` の**画面に出る文字だけ GOOD REVIEW** にし、
**内部の識別子（`--loop-` 接頭辞・ドメイン・リポジトリ名）は触らない。**
全体改名は独立したタスクとして、影響範囲の棚卸しから別途やる。

**やらなかった場合：** 画面上は GOOD REVIEW、コード上は `--loop-` という状態がしばらく続きます。
気持ち悪さはありますが、壊れません。

### 9-10. 免責・景表法の文言

「AIに出てくるようになる」と読める表現は避ける必要があります。プロトタイプのフッター文と
入力画面の注記は、その配慮がよくできています。**そのまま踏襲することを推奨**します。

- 「掲載や順位を保証するものではありません」
- 「結果は計測時点のスナップショットです」
- 「β版はClaudeのみ実測です」

これらは**クライアントの目に触れる文言**なので、最終的な文面は天真に確認します。

### 9-11. AI生成物の開示

レポート内に「Claude 実測」であることを明示します（既存 `AiBadge` の流用を検討）。
GOOD REVIEW のクチコミ下書き画面と同じ姿勢です。

### 9-12. サンプルレポートを載せるか ★着手前

プロトタイプには「サンプルレポートを見る — YORKYS BRUNCH」ボタンがあり、
**架空の競合店名を含むデモデータ**を表示します。天真の仕様書には記載がありません。

**推奨：初回リリースには含めない。** 理由は2つ。
1. 架空データを本番サイトに置くと、実測結果と見分けが付かなくなるリスクがある
2. 要因分析（＝サンプルにしかない情報）を出さない方針（9-1案1）なら、サンプルの価値が下がる

ただし **APIが全滅したときのフォールバック画面**は必要なので、失敗バナー（入力に戻る）だけは作ります。

### 9-13. Figma との関係

この機能は Figma に対応するノードがありません。`docs/specs/design-rules.md` は
「ピクセルを作る前に操作の流れを文章で合意する」「案は3つ出す」と定めていますが、
**今回は既にプロトタイプHTMLという原本があり、天真がそれを承認済み**という理解です。

したがって：
- フェーズ0で「操作の流れ・状態一覧」を文章で出す（design-rules 1-1 は守る）
- 3案は出さない（プロトタイプが決定稿のため）
- **Figma への反映は実装後に別セッションで行う**（PC/SP対で作る必要があるため、それなりの作業量）

この理解でよいか、フェーズ0で確認します。

### 9-14. 結果が毎回変わること

AIの回答は日時・文脈・モデル更新で変動します。同じ店で2回診断するとスコアが変わり得ます。
これは仕様であり、免責に明記します（9-10）。将来「定点観測」を売りにする際は、
`ai_check_sessions` が既に履歴テーブルになっているのでそのまま使えます。

---

## 10. この計画で作らないもの（スコープ外）

- ChatGPT / Gemini の実測（β版はClaudeのみ。列だけ用意する）
- フルレポートのメール送信（Resend の鍵が未取得）
- 診断結果の再訪・共有URL
- 管理画面からのリード一覧表示
- Figma への画面反映（後追い）
- GOOD REVIEW → GOOD REVIEW の全体改名（9-9）
- 定点観測・月次レポート（CTAで訴求はするが、実装はしない）

---

## 11. 実装時に計画から変えたこと（2026-08-17）

| 計画 | 実装 | 理由 |
|---|---|---|
| `POST /api/ai-check/questions` | **`POST /api/checker/ask`** | 天真の指定 |
| セッションを作ってから質問を実行 | **セッション無し。1問＝1リクエストで完結** | 天真の指定。DBへの保存はフェーズ4に後ろ倒し |
| `/api/ai-check/sessions` `/finalize` | **作っていない** | 質問文の生成もスコア計算も純粋関数なのでクライアントで足りる |
| 診断中は「質問中 → 照合中 → 結果」の3段 | **「質問中（経過秒数）→ 結果」の2段** | 質問と照合を1つのAPIで行うため、ブラウザ側に照合の開始時刻が分からない。分からないものを表示すると嘘になるので、代わりに経過秒数を出した。3段に戻すなら ask と judge をエンドポイントごと分ける必要がある |
| モデルは Sonnet 5 を推奨 | **Haiku 4.5（`claude-haiku-4-5-20251001`）** | 天真の決定 |
| Web検索ツール `web_search_20260209` | **`web_search_20250305`** | 新版は Opus 4.6 / Sonnet 4.6 以降専用。Haiku 4.5 では基本版が正しい |

### ⚠ セッションを廃したことで、コストの上限が無くなっている

計画 9-6 では `unique(session_id, idx)` で「1セッション＝最大3回のAI呼び出し」に上限を掛ける
設計でした。セッションを持たない今の形では、**`/api/checker/ask` を叩いた回数だけ課金が発生します。**

現状で効いている歯止めは、Web検索の `max_uses: 3` だけです。
**本番公開の前に、IPハッシュによるレート制限（フェーズ4）を必ず入れること。**

### devサーバー起動中に `npm run build` を実行しないこと

`.next` のキャッシュが壊れ、devサーバーが `Cannot find module './xxx.js'` で500を返すようになります
（2026-08-17 に発生）。CLAUDE.md が `npm install` について書いている注意と同じ現象です。
`npm run check` はビルドを含むので、**devサーバーを止めてから回すか、回したあとにdevサーバーを再起動する**こと。

---

_作成: 2026-08-17 / 状態: フェーズ1（UI）・フェーズ2（計測API）まで実装済み_
