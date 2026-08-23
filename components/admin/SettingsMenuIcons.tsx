/**
 * 設定メニューのアイコン6種（Figma `MTG / 99 素材 / 設定アイコン6種（線画・グリーン＋イエロー）`）。
 *
 * 2026-08-23、天真の指示で**塗りタイルから線画に描き直した**（Figmaコメント 1895710386）。
 * 「PayPayのアイコンとかなり異なります。塗りではなく線のアイコンに。
 *   基本グリーンが９０％ぐらい占めて、アクセントでイエローを１０％という感じ。」
 *
 * ルール：線＝グリーン（`--loop-accent-primary`）、各アイコンに**黄のアクセントを1点だけ**
 * （`--product-color-icon-yellow`）。黄を増やさないこと。
 *
 * SVGの属性には `var()` が効かないため `style` で色を渡している
 * （CLAUDE.md 4章「SVGは属性にvar()を書いても解決されない」）。
 */

const GREEN = "var(--loop-accent-primary)";
const YELLOW = "var(--product-color-icon-yellow)";
const LINE = { fill: "none", stroke: GREEN, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true" style={{ overflow: "visible" }}>
      {children}
    </svg>
  );
}

/** ブランドとテーマ ＝ 色の丸＋黄の点 */
export function BrandIcon() {
  return (
    <Svg>
      <circle cx="12" cy="14" r="9" style={LINE} />
      <circle cx="20.5" cy="20.5" r="3.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** 店舗管理／卓上POP ＝ 二次元コード（黄の1マス） */
export function StoreIcon() {
  return (
    <Svg>
      <rect x="3" y="3" width="22" height="22" rx="5" style={LINE} />
      <rect x="8" y="8" width="5" height="5" rx="1.5" style={LINE} />
      <rect x="15" y="8" width="5" height="5" rx="1.5" style={LINE} />
      <rect x="8" y="15" width="5" height="5" rx="1.5" style={LINE} />
      <rect x="15.5" y="15.5" width="5" height="5" rx="1.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** アンケート項目 ＝ リスト＋黄のチェック */
export function SurveyIcon() {
  return (
    <Svg>
      <rect x="4" y="3" width="20" height="22" rx="5" style={LINE} />
      <path d="M9 10h10" style={LINE} />
      <path d="M9 15h6" style={LINE} />
      <path d="M9 20.5l2.5 2.5 4.5-4.5" style={{ ...LINE, stroke: YELLOW }} />
    </Svg>
  );
}

/** 通知 ＝ 封筒＋黄の通知ドット */
export function NotificationIcon() {
  return (
    <Svg>
      <rect x="3" y="6" width="22" height="16" rx="4" style={LINE} />
      <path d="M6 9.5l8 6 8-6" style={LINE} />
      <circle cx="23" cy="5" r="3" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** お支払い ＝ カード＋黄のチップ */
export function BillingIcon() {
  return (
    <Svg>
      <rect x="3" y="5" width="22" height="18" rx="4" style={LINE} />
      <path d="M3 11h22" style={LINE} />
      <rect x="7" y="16" width="6" height="3.5" rx="1.5" style={{ fill: YELLOW }} />
    </Svg>
  );
}

/** アカウント ＝ 人＋黄の点 */
export function AccountIcon() {
  return (
    <Svg>
      <circle cx="14" cy="9.5" r="4.5" style={LINE} />
      <path d="M6 24c0-5.5 16-5.5 16 0" style={LINE} />
      <circle cx="22.25" cy="5.25" r="2.75" style={{ fill: YELLOW }} />
    </Svg>
  );
}
