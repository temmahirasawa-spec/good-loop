# GOOD LOOP

実店舗向けの「Googleレビュー獲得 × 顧客満足度アンケート」SaaS。
株式会社UTUTU の自社プロダクト。GOOD ORDER と同じ GOODシリーズ。

来店客が卓上POPのQRを読み、5段階評価に答えます。
★4〜5 は AI が書いたクチコミの下書きをコピーして Google マップへ、
★1〜3 は店内向けの改善アンケートへ分岐します。

## 開発

```bash
npm install
npm run dev        # http://localhost:3000
```

## 検品

```bash
npm run check         # typecheck → lint → secrets → tenant → design → build
npm run design:figma  # Figma の構造・パディング・セクション色の検品（FIGMA_TOKEN が必要）
```

`npm run check` が通っていない作業は完了ではありません。詳細は [CLAUDE.md](./CLAUDE.md)。

## 環境変数

`.env.local.example` をコピーして `.env.local` を作り、実値を入れてください。
**このリポジトリは public です。実値をコミットしないこと**（`npm run secrets` が検出します）。

## ドキュメント

| ファイル | 中身 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | このリポジトリの規約 |
| [docs/handoff.md](./docs/handoff.md) | 実装の経緯と判断の履歴 |
| [docs/specs/design-rules.md](./docs/specs/design-rules.md) | Figma 作業のルール |
