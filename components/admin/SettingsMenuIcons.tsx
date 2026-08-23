/**
 * 設定メニューのアイコン7種（Figma `Review / Settings Icon`、node 758:12625）。
 *
 * **形の source of truth は Figma 側。** 2026-08-23、天真が全アイコンを手で調整した
 * （Figmaコメント 1895939385「これ以降勝手に修正しないで」）。Figma の SVG 書き出しを
 * ここへ写し取っている。形を変えたくなったら、先に Figma を直してから同期すること。
 *
 * ルール：線＝グリーン（`--review-accent-primary`）、各アイコンに黄のアクセントを1点だけ
 * （`--product-color-icon-yellow`）。黄を増やさないこと。
 *
 * `small` を渡すと 20px で描く（サイドバーの設定下層リンク用。Figma の Size=sm バリアント）。
 * viewBox ごと縮むため線幅も約1pxになり、Figma の「小サイズは1px線」と同じ見え方になる。
 *
 * SVGの属性には `var()` が効かないため `style` で色を渡している
 * （CLAUDE.md 4章「SVGは属性にvar()を書いても解決されない」）。
 */

const GREEN = "var(--review-accent-primary)";
const YELLOW = "var(--product-color-icon-yellow)";
const LINE = { fill: "none", stroke: GREEN, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export type IconProps = { small?: boolean };

function Svg({ small, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 28 28" className={small ? "size-5 shrink-0" : "size-7 shrink-0"} aria-hidden="true" style={{ overflow: "visible" }}>
      {children}
    </svg>
  );
}

/** ブランドとテーマ ＝ 色の丸＋黄の点 */
export function BrandIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <circle cx="12" cy="14" r="8.1" style={LINE} />
      <circle cx="20.5" cy="20.5" r="3.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** 店舗管理 ＝ 二次元コード（黄の1マス）。小さい四角は内側線なので中心線に換算して描く */
export function StoreIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <rect x="3.9" y="3.9" width="20.2" height="20.2" rx="4.1" style={LINE} />
      <rect x="8.9" y="8.9" width="3.2" height="3.2" rx="0.6" style={LINE} />
      <rect x="15.9" y="8.9" width="3.2" height="3.2" rx="0.6" style={LINE} />
      <rect x="8.9" y="15.9" width="3.2" height="3.2" rx="0.6" style={LINE} />
      <rect x="15.5" y="15.5" width="5" height="5" rx="1.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** アンケート項目 ＝ リスト＋黄のチェック */
export function SurveyIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <rect x="4.9" y="3.9" width="18.2" height="20.2" rx="4.1" style={LINE} />
      <path d="M9 10h10" style={LINE} />
      <path d="M9 15h6" style={LINE} />
      <path d="M13 18.5l2.5 2.5 4.5-4.5" style={{ ...LINE, stroke: YELLOW }} />
    </Svg>
  );
}

/** 通知 ＝ 封筒＋黄の通知ドット */
export function NotificationIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <rect x="3.9" y="6.9" width="20.2" height="14.2" rx="3.1" style={LINE} />
      <path d="M6 9.5l8 6 8-6" style={LINE} />
      <circle cx="24" cy="8" r="3" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** お支払い ＝ カード＋黄のチップ */
export function BillingIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <rect x="3.9" y="5.9" width="20.2" height="16.2" rx="3.1" style={LINE} />
      <path d="M5 11h18" style={LINE} />
      <rect x="7" y="16" width="6" height="3.5" rx="1.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** 卓上POP ＝ 正面のパネル＋机の線＋黄の紙面（QRは描かない。天真が描き直した形） */
export function PopIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <path d="M3.9 23.1h20.2" style={LINE} />
      <rect x="7" y="5" width="14" height="18" rx="1" style={LINE} />
      <rect x="10" y="10" width="8" height="8" rx="2" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** アカウント ＝ 人＋黄の点 */
export function AccountIcon({ small }: IconProps = {}) {
  return (
    <Svg small={small}>
      <circle cx="14" cy="12" r="4.1" style={LINE} />
      <path d="M6 23c0-5.33 16-5.33 16 0" style={LINE} />
      <circle cx="22.25" cy="6.25" r="2.75" style={{ fill: YELLOW }} />
    </Svg>
  );
}
