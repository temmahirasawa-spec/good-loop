/**
 * アンケート v2 プロトタイプのデータ（docs/specs/survey-v2.md 段1）。
 *
 * **検証用。DBには一切書き込まない。** 中身は YORKYS BRUNCH（夙川）の実メニュー
 * （2026-08-28 天真提供の YBmenu.pdf。未確定版）。本番では店舗ごとにDBから来る。
 *
 * 2026-08-28 の再設計（チャッピー資料＋天真の方針）:
 *   ・**商品と感想を item 単位で紐づける**（「どの料理の感想か」を曖昧にしない）
 *   ・「食べていない」は商品カテゴリと**排他**
 *   ・章は「4ページ」ではなく**縦長フォーム内の意味の章**（今日のこと→料理・サービス→
 *     印象に残ったこと→伝えたいこと）
 *   ・選択肢は**事実型**を中心にする（表現型は自由記述・音声から拾う）
 */

export const STORE_NAME = "YORKYS BRUNCH 夙川";

export type Choice = { id: string; label: string };

/** ── 章 ─────────────────────────────────────── */

export type Chapter = { id: string; title: string; seconds: number };

export const CHAPTERS: Chapter[] = [
  { id: "today", title: "今日のこと", seconds: 10 },
  { id: "food", title: "料理・サービス", seconds: 25 },
  { id: "impression", title: "印象に残ったこと", seconds: 15 },
  { id: "message", title: "伝えたいこと", seconds: 10 },
];

/** ── 実メニュー（YBmenu.pdf より。チップに載るよう短縮した名前） ── */

export type MenuCategory = { id: string; label: string; items: Choice[] };

export const MENU: MenuCategory[] = [
  {
    id: "pancake",
    label: "パンケーキ",
    items: [
      { id: "pc-plain", label: "プレーンパンケーキ" },
      { id: "pc-anko", label: "あんこクリームチーズ" },
      { id: "pc-tiramisu", label: "ティラミスパンケーキ" },
      { id: "pc-matcha", label: "抹茶のパンケーキ" },
      { id: "pc-blueberry", label: "ブルーベリーホワイトチョコ" },
      { id: "pc-chocobanana", label: "チョコバナナクッキー" },
      { id: "pc-brekkie", label: "ヨーキーズ ブレッキー" },
    ],
  },
  {
    id: "frenchtoast",
    label: "フレンチトースト",
    items: [
      { id: "ft-plain", label: "フレンチトースト プレーン" },
      { id: "ft-caramel", label: "塩キャラメルバナナ" },
      { id: "ft-fruits", label: "フルーツ添え" },
    ],
  },
  {
    id: "toast",
    label: "トースト",
    items: [
      { id: "to-pumpkin", label: "かぼちゃアボカドトースト" },
      { id: "to-banana", label: "バナナアーモンドバター" },
      { id: "to-egg", label: "スクランブルエッグとチーズ" },
    ],
  },
  {
    id: "benedict",
    label: "エッグベネディクト",
    items: [
      { id: "eb-bacon", label: "ベーコンとほうれん草" },
      { id: "eb-salmon", label: "サーモンとアボカド" },
      { id: "eb-ham", label: "生ハムとマスカルポーネ" },
    ],
  },
  {
    id: "burger",
    label: "ハンバーガー",
    items: [
      { id: "bg-yorkys", label: "YORKYSバーガー" },
      { id: "bg-avocado", label: "アボカドとゴルゴンゾーラ" },
    ],
  },
  {
    id: "pizza-pasta",
    label: "ピッツァ・パスタ",
    items: [
      { id: "pz-margherita", label: "マルゲリータ" },
      { id: "pz-ortolana", label: "オルトラーナ" },
      { id: "pz-quattro", label: "クアトロフォルマッジョ" },
      { id: "pa-vongole", label: "アサリと舞茸のクリーム" },
      { id: "pa-puttanesca", label: "プッタネスカ" },
      { id: "pa-carbonara", label: "カルボナーラ トリュフ風味" },
      { id: "pa-bolognese", label: "茄子のボロネーゼ" },
    ],
  },
  {
    id: "rice",
    label: "ライス",
    items: [
      { id: "ri-omurice", label: "デミグラスオムライス" },
      { id: "ri-locomoco", label: "淡路牛ロコモコボウル" },
    ],
  },
  {
    id: "salad-bowl",
    label: "サラダ・ボウル",
    items: [
      { id: "sa-green", label: "グリーンサラダボウル" },
      { id: "sa-caesar", label: "ハーブチキンのシーザー" },
      { id: "sa-acai", label: "トリプルベリーアサイー" },
      { id: "sa-yogurt", label: "グリークヨーグルトボウル" },
    ],
  },
  {
    id: "drink",
    label: "ドリンク",
    items: [
      { id: "dr-coffee", label: "コーヒー" },
      { id: "dr-latte", label: "カフェラテ" },
      { id: "dr-matcha", label: "抹茶ラテ" },
      { id: "dr-hojicha", label: "ほうじ茶ラテ" },
      { id: "dr-tea", label: "紅茶" },
      { id: "dr-juice", label: "ジュース" },
    ],
  },
];

export const EAT_NOTHING_ID = "nothing";

export function findItem(itemId: string): Choice | undefined {
  for (const category of MENU) {
    const found = category.items.find((i) => i.id === itemId);
    if (found) return found;
  }
  return undefined;
}

/** ── 選択肢（事実型を中心にする。docs/specs/survey-v2.md §10） ── */

export const RATING_CHOICES: Choice[] = [
  { id: "5", label: "とても満足" },
  { id: "4", label: "満足" },
  { id: "3", label: "ふつう" },
  { id: "2", label: "やや不満" },
  { id: "1", label: "不満" },
];

export const VISIT_CHOICES: Choice[] = [
  { id: "first", label: "初めて" },
  { id: "few", label: "2回目以降" },
  { id: "regular", label: "常連" },
];

/**
 * 品の感想の選択肢は**AIが品名から作る**（/api/demo/draft の mode: "choices"）。
 * ここにあるのは**AIが落ちたときのカテゴリ別の退避リスト**。
 * 固定リスト1本だと「グリーンサラダボウルに『ふわふわだった』」が出る（2026-08-28 天真の指摘）。
 */
export const ATTR_FALLBACK: Record<string, string[]> = {
  pancake: ["ふわふわだった", "口の中で溶けた", "見た目がきれい", "量がちょうどよい", "甘さがちょうどよい", "できたてで温かい"],
  frenchtoast: ["しっとりしていた", "甘さがちょうどよい", "見た目がきれい", "量がちょうどよい", "できたてで温かい"],
  toast: ["パンが香ばしい", "具がたっぷり", "見た目がきれい", "量がちょうどよい"],
  benedict: ["ソースがおいしい", "卵がとろとろ", "見た目がきれい", "量がちょうどよい"],
  burger: ["ボリュームがある", "バンズがおいしい", "素材の味がいい", "見た目がきれい"],
  "pizza-pasta": ["味付けがよい", "生地・麺の食感がよい", "素材の味がいい", "量がちょうどよい", "できたてで温かい"],
  rice: ["味付けがよい", "ボリュームがある", "見た目がきれい", "できたてで温かい"],
  "salad-bowl": ["野菜が新鮮", "彩りがきれい", "量がちょうどよい", "ドレッシングがおいしい", "さっぱりしている"],
  drink: ["香りがよい", "温度がちょうどよい", "甘さがちょうどよい", "見た目がきれい"],
};

export function fallbackAttrsFor(itemId: string): string[] {
  for (const category of MENU) {
    if (category.items.some((i) => i.id === itemId)) return ATTR_FALLBACK[category.id] ?? ATTR_FALLBACK.pancake;
  }
  return ATTR_FALLBACK.pancake;
}

export function categoryOf(itemId: string): MenuCategory | undefined {
  return MENU.find((c) => c.items.some((i) => i.id === itemId));
}

export const SERVICE_CHOICES: Choice[] = [
  { id: "none", label: "特になし" },
  { id: "kind", label: "感じがよかった" },
  { id: "explain", label: "説明が分かりやすい" },
  { id: "quick", label: "対応が早い" },
  { id: "care", label: "気配りがあった" },
];

export const ATMOSPHERE_CHOICES: Choice[] = [
  { id: "none", label: "特になし" },
  { id: "calm", label: "落ち着いて過ごせた" },
  { id: "roomy", label: "席がゆったり" },
  { id: "clean", label: "清潔だった" },
  { id: "bright", label: "明るくて気持ちいい" },
];

export const CONCERN_CHOICES: Choice[] = [
  { id: "none", label: "特になし" },
  { id: "wait", label: "待ち時間" },
  { id: "seat", label: "席の間隔" },
  { id: "price", label: "値段" },
  { id: "noise", label: "店内の音" },
];

export const POSITIVE_CHOICES: Choice[] = [
  { id: "none", label: "特になし" },
  { id: "taste", label: "料理の味" },
  { id: "service", label: "接客" },
  { id: "atmosphere", label: "雰囲気" },
  { id: "location", label: "通いやすさ" },
];

export const labelsOf = (choices: Choice[], ids: string[]): string[] =>
  ids.map((id) => choices.find((c) => c.id === id)?.label ?? "").filter((l) => l !== "" && l !== "特になし" && l !== "その他");

/** ── 文体 ─────────────────────────────────── */

export type Tone = "normal" | "casual";

export const TONES: { id: Tone; label: string }[] = [
  { id: "normal", label: "ふつう" },
  { id: "casual", label: "カジュアル" },
];
