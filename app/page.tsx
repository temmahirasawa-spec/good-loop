/**
 * 動作確認用のページ。
 *
 * この土台のPRでは「Next.js が起動し、ビルドが通り、Vercel のプレビューが出る」ことだけを
 * 確かめる。デザインの実装は次のセッションで、Figma（file key i7z9wGL6BpFoC2kwlGA1lV）の
 * Loop Theme に沿って行う。ここで見た目を作り込まないこと。
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">GOOD LOOP</h1>
      <p className="mt-2">実店舗向け Googleレビュー獲得 × 顧客満足度アンケート</p>
      <p className="mt-6 text-sm">
        土台の動作確認用ページです。画面の実装はこれからです。
      </p>
    </main>
  );
}
