/**
 * v5 の話題（docs/specs/survey-v5.md §3）。v4 の `topic-questions.ts` は v4 の試作が使っているので触らない。
 *
 * **2カラムで並べるので偶数（6つ）にした**（Figma `02 / 良かった点` 1:360 の2カラムのタグに合わせた）。
 * 名前は v4 と同じく**良くも悪くも言える中立の言葉**にしてある（Figma の「コスパ」「提供スピード」は
 * 良かった点を前提にした言葉なので採らず、「値段」「待ち時間」のまま）。料理とドリンクは1つにまとめた。
 *
 * **例文は1つも出さない。出すのは問いだけ。** 1話題3問を用意し、セッションごとに1問を回す（v4 と同じ理由）。
 * ⚠ 業態依存なのは語彙だけ。本番では店舗ごとにDBから来る。ここにあるのは飲食1業態の初期値。
 */
export type V5Topic = {
  id: string;
  /** 2カラムのカードに出す名前 */
  label: string;
  /** 書く画面の欄の見出し */
  fieldLabel: string;
  questions: [string, string, string];
};

export const V5_TOPICS: V5Topic[] = [
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
];

/** 選んだ話題の欄のあとに、いつも出す欄（2026-09-26 天真） */
export const OTHER_FIELD = {
  id: "other",
  fieldLabel: "その他（自由記入）",
  questions: ["ほかに伝えたいことはありますか？", "書き足したいことがあれば、どうぞ。", "ほかに覚えていることはありますか？"] as [string, string, string],
};

export function v5Topic(id: string): V5Topic | undefined {
  return V5_TOPICS.find((t) => t.id === id);
}
