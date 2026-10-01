/**
 * v5 の話題（docs/specs/survey-v5.md §3）。v4 の `topic-questions.ts` は v4 の試作が使っているので触らない。
 *
 * **2カラムで並べるので、どの業態も偶数（6つ）にした**（Figma `02 / 良かった点` 1:360 の2カラムのタグに合わせた）。
 * 名前は v4 と同じく**良くも悪くも言える中立の言葉**にしてある（Figma の「コスパ」「提供スピード」は
 * 良かった点を前提にした言葉なので採らず、「値段」「待ち時間」のまま）。料理とドリンクは1つにまとめた。
 *
 * **例文は1つも出さない。出すのは問いだけ。** 1話題3問を用意し、セッションごとに1問を回す（v4 と同じ理由）。
 *
 * 業態依存なのは語彙だけ（2026-08-29 の整理）。**コードに業態の分岐を書かず、話題のセットを差し替える。**
 * 2026-10-01、本番化（試験導入に飲食以外のお店も入る）に合わせて、医療系と一般のセットを足した。
 * ⚠ 飲食以外のセットの文言は天真さんの確認待ち（CLAUDE.md 3章）。
 *
 * id は回答（survey_responses.topics）に保存される。**一度使った id の意味を変えない**（過去の回答の読み方が変わる）。
 */
export type V5Topic = {
  id: string;
  /** 2カラムのカードに出す名前 */
  label: string;
  /** 書く画面の欄の見出し */
  fieldLabel: string;
  questions: [string, string, string];
};

const TOPICS: V5Topic[] = [
  // ── 飲食（2026-09-28 版のまま） ──
  {
    id: "food",
    label: "料理・ドリンク",
    fieldLabel: "料理・ドリンクについて",
    questions: ["どの料理やドリンクが、どうでしたか？", "今日頼んだのは何でしたか？", "それは、どんな感じでしたか？"],
  },
  {
    id: "service",
    label: "接客・スタッフ",
    fieldLabel: "接客・スタッフについて",
    questions: ["接客で、どんなことがありましたか？", "どんな場面のことですか？", "何があったか、覚えていますか？"],
  },
  {
    id: "atmosphere",
    label: "店内の雰囲気",
    fieldLabel: "店内の雰囲気について",
    questions: ["店内は、どんな感じでしたか？", "どのあたりが印象に残りましたか？", "席や広さは、どうでしたか？"],
  },
  {
    id: "wait",
    label: "待ち時間",
    fieldLabel: "待ち時間について",
    questions: ["どの場面で、どのくらい待ちましたか？", "いつ、どのくらいでしたか？", "どこで待ちましたか？"],
  },
  {
    id: "price",
    label: "値段",
    fieldLabel: "値段について",
    questions: ["値段について、どう感じましたか？", "何の値段のことですか？", "どのあたりが気になりましたか？"],
  },
  {
    id: "clean",
    label: "清潔さ",
    fieldLabel: "清潔さについて",
    questions: ["清潔さについて、どう感じましたか？", "どこのことですか？", "何が気になりましたか？"],
  },

  // ── 一般（美容室・エステ・フィットネス・スクール・ペット・宿泊など）2026-10-01 ──
  {
    id: "content",
    label: "サービスの内容",
    fieldLabel: "サービスの内容について",
    questions: ["どんなサービスを受けましたか？", "受けてみて、どうでしたか？", "どのあたりが印象に残りましたか？"],
  },
  {
    id: "booking",
    label: "待ち時間・予約",
    fieldLabel: "待ち時間・予約について",
    questions: ["予約や待ち時間は、どうでしたか？", "どの場面で、どのくらい待ちましたか？", "予約のとり方は、どうでしたか？"],
  },
  {
    id: "fee",
    label: "料金",
    fieldLabel: "料金について",
    questions: ["料金について、どう感じましたか？", "何の料金のことですか？", "どのあたりが気になりましたか？"],
  },

  // ── 医療系（クリニック・整骨院）2026-10-01。効き目や結果を書かせる言葉は使わない ──
  {
    id: "explanation",
    label: "説明",
    fieldLabel: "説明について",
    questions: ["どんな説明がありましたか？", "説明を聞いて、どう感じましたか？", "どのあたりが印象に残りましたか？"],
  },
  {
    id: "treatment",
    label: "施術・診察",
    fieldLabel: "施術・診察について",
    questions: ["どんな施術や診察でしたか？", "受けてみて、どうでしたか？", "どのあたりが印象に残りましたか？"],
  },
  {
    id: "reception",
    label: "受付・スタッフ",
    fieldLabel: "受付・スタッフについて",
    questions: ["受付やスタッフの対応で、どんなことがありましたか？", "どんな場面のことですか？", "何があったか、覚えていますか？"],
  },
  {
    id: "clinic-room",
    label: "院内の雰囲気・清潔さ",
    fieldLabel: "院内の雰囲気・清潔さについて",
    questions: ["院内は、どんな感じでしたか？", "どのあたりが印象に残りましたか？", "清潔さについて、どう感じましたか？"],
  },
  {
    id: "cost",
    label: "費用",
    fieldLabel: "費用について",
    questions: ["費用について、どう感じましたか？", "何の費用のことですか？", "どのあたりが気になりましたか？"],
  },
];

/** 業態（stores.business_category）ごとの6つ。並びは2カラムの左上から */
const PRESETS = {
  restaurant: ["food", "service", "atmosphere", "wait", "price", "clean"],
  medical: ["explanation", "treatment", "reception", "booking", "clinic-room", "cost"],
  general: ["content", "service", "atmosphere", "booking", "fee", "clean"],
} as const;

/** lib/admin/constants.ts の BUSINESS_CATEGORIES の slug → 話題のセット */
const PRESET_OF_CATEGORY: Record<string, keyof typeof PRESETS> = {
  restaurant: "restaurant",
  clinic: "medical",
  seikotsuin: "medical",
};

function byId(id: string): V5Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

function pick(ids: readonly string[]): V5Topic[] {
  return ids.map((id) => byId(id)).filter((t): t is V5Topic => t !== undefined);
}

/** 飲食のセット（/demo/v5 の初期値。2026-09-28 版） */
export const V5_TOPICS: V5Topic[] = pick(PRESETS.restaurant);

/** 店舗の業態に合わせた6つ。知らない業態は一般のセットにする */
export function v5TopicsFor(businessCategory: string | null | undefined): V5Topic[] {
  return pick(PRESETS[PRESET_OF_CATEGORY[businessCategory ?? ""] ?? "general"]);
}

/** 選んだ話題の欄のあとに、いつも出す欄（2026-09-26 天真） */
export const OTHER_FIELD = {
  id: "other",
  fieldLabel: "その他（自由記入）",
  questions: ["ほかに伝えたいことはありますか？", "書き足したいことがあれば、どうぞ。", "ほかに覚えていることはありますか？"] as [string, string, string],
};

/** id から話題を引く（業態をまたいで引ける。管理画面で過去の回答を読むときにも使う） */
export function v5Topic(id: string): V5Topic | undefined {
  return byId(id);
}

/** 回答の保存のときの検査用。欄の id として正しいか（話題＋その他） */
export function isV5FieldId(id: string): boolean {
  return id === OTHER_FIELD.id || byId(id) !== undefined;
}
