import Image from "next/image";

/**
 * GOOD REVIEW の正式なロゴ（Figma「LP v2 / Logo」1477:14726 の Color=Default）。
 * 2026-09-28 に天真が作った原画（Dropbox UTUTU/LOGOS/review_yoko.svg）を public/brand/good-review.svg にそのまま置いた
 * （除いたのは XML 宣言と Illustrator のコメントだけ）。色は原画のまま＝ブランドの資産なので、業態のテーマでは変えない。
 * 公式サイト（good-review.jp）の差し替えと同じやり方。
 *
 * 高さは、差し替え前の文字のロゴと大文字の高さがそろう値を渡す（サイドメニュー 18・ログイン 22 など）。
 * width・height の属性は整数（端数だと next/image が開発時に警告する。見た目の大きさは style で持つ）。
 */
const RATIO = 631.2 / 66.7;

export function BrandLogo({ height, className }: { height: number; className?: string }) {
  const width = Math.round(height * RATIO * 100) / 100;
  return (
    <Image
      src="/brand/good-review.svg"
      alt="GOOD REVIEW"
      width={Math.round(width)}
      height={height}
      style={{ width, height }}
      className={className ?? "block shrink-0"}
      unoptimized
      priority
    />
  );
}
