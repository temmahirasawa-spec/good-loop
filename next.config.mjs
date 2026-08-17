/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * ビルドの出力先。既定は `.next`。
   *
   * ⚠ devサーバーの起動中に `next build` を走らせると、devサーバーが使っている `.next` を
   *   上書きしてしまい、`Cannot find module './xxx.js'` で500を返すようになる（2026-08-17に発生）。
   *   `npm run check`（Stop hookが毎回実行する）にはビルドが含まれるため、
   *   放っておくと**AIが応答するたびにdevサーバーが壊れる**。
   *
   *   そのため検品時だけ `NEXT_BUILD_DIR=.next-check` を渡して出力先を分けている
   *   （package.json の `build:check`）。
   *   Vercel は `npm run build` を直接呼ぶので、本番のデプロイには影響しない。
   */
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
