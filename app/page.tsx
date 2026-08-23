/**
 * 動作確認用のページ。
 *
 * この土台のPRでは「Next.js が起動し、ビルドが通り、Vercel のプレビューが出る」ことだけを
 * 確かめる。**公式サイト（LP）の実装はこれから**（launch-plan.md フェーズ6）。
 * Figma の `Web Design Master / 01 LP` にデザインがある。
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">GOOD REVIEW</h1>
      <p className="mt-2">実店舗向け Googleレビュー獲得 × 顧客満足度アンケート</p>
      <p className="mt-6 text-sm">
        土台の動作確認用ページです。画面の実装はこれからです。
      </p>
    </main>
  );
}
