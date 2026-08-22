/**
 * 設定メニューのアイコン6種（Figma `MTG / 99 素材 / 設定アイコン6種（ツートーン）`）。
 *
 * 2026-08-22、天真の指示（UI検証Q6のFigmaコメント）で作成。
 * 「アイコンはツートーン（PayPayで使われているアイコンを参考に）」という指定に沿って、
 * 線画ではなく**塗りの2色**（濃い＝`--loop-accent-primary` / 薄い＝`--loop-accent-wash`）で描く。
 *
 * SVGの属性には `var()` が効かないため、`fill="currentColor"` は使わず
 * `style` で色を渡している（CLAUDE.md 4章「SVGは属性にvar()を書いても解決されない」）。
 */

const MAIN = "var(--loop-accent-primary)";
const SUB = "var(--loop-accent-wash)";

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
      {children}
    </svg>
  );
}

/** ブランドとテーマ ＝ 色の見本 */
export function BrandIcon() {
  return (
    <Svg>
      <circle cx="14" cy="14" r="14" style={{ fill: SUB }} />
      <circle cx="14" cy="14" r="8" style={{ fill: MAIN }} />
      <circle cx="19" cy="11" r="2.5" style={{ fill: "var(--product-color-surface-white)" }} />
    </Svg>
  );
}

/** 店舗・二次元コード管理 ＝ 二次元コード */
export function StoreIcon() {
  return (
    <Svg>
      <rect width="28" height="28" rx="8" style={{ fill: SUB }} />
      <rect x="6" y="6" width="7" height="7" rx="2" style={{ fill: MAIN }} />
      <rect x="15" y="6" width="7" height="7" rx="2" style={{ fill: MAIN }} />
      <rect x="6" y="15" width="7" height="7" rx="2" style={{ fill: MAIN }} />
      <rect x="16" y="16" width="5" height="5" rx="1.5" style={{ fill: MAIN }} />
    </Svg>
  );
}

/** アンケート項目 ＝ 項目の一覧 */
export function SurveyIcon() {
  return (
    <Svg>
      <rect x="2" width="24" height="28" rx="7" style={{ fill: SUB }} />
      <rect x="7" y="8" width="14" height="2.6" rx="1.3" style={{ fill: MAIN }} />
      <rect x="7" y="14" width="9" height="2.6" rx="1.3" style={{ fill: MAIN }} />
      <rect x="7" y="20" width="11" height="2.6" rx="1.3" style={{ fill: MAIN }} />
    </Svg>
  );
}

/** 通知 ＝ 封筒（メールで届くため） */
export function NotificationIcon() {
  return (
    <Svg>
      <rect y="5" width="28" height="18" rx="5" style={{ fill: MAIN }} />
      <path d="M5 9 L14 16 L23 9" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: SUB }} />
    </Svg>
  );
}

/** お支払い ＝ カード */
export function BillingIcon() {
  return (
    <Svg>
      <rect y="4" width="28" height="20" rx="6" style={{ fill: SUB }} />
      <rect y="10" width="28" height="4" style={{ fill: MAIN }} />
      <rect x="4" y="18" width="8" height="2.6" rx="1.3" style={{ fill: MAIN }} />
    </Svg>
  );
}

/** アカウント ＝ 人 */
export function AccountIcon() {
  return (
    <Svg>
      <circle cx="14" cy="14" r="14" style={{ fill: SUB }} />
      <circle cx="14" cy="10.5" r="4.5" style={{ fill: MAIN }} />
      <rect x="6" y="17" width="16" height="9" rx="4.5" style={{ fill: MAIN }} />
    </Svg>
  );
}
