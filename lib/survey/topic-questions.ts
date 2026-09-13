/**
 * v4 の話題タグと、本文欄のプレースホルダに出す「問い」（docs/specs/survey-v4.md §4 S2）。
 *
 * **例文は1つも出さない。出すのは問いだけ。**
 * 例文を出すと全員がそれをなぞって文面が収束する（Doshi & Hauser, Science Advances 2024 の均質化）。
 * 問いは答えの形を決めないが、例文は決めてしまう。
 *
 * **1タグにつき3問を用意し、セッションごとに1問を回す。**
 * 同じ店で同じ問いが100回並ぶと、答えの話題の分布が問いの形に寄るため。
 *
 * **AIは一切呼ばない。** 静的なテーブルなので待ち時間ゼロ・誤りゼロ。
 *
 * ⚠ 業態依存なのは**語彙だけ**。9業態ぶんの分岐をコードに書かない
 *   （CLAUDE.md 4章のモード切替原則と、2026-08-29 の「広げない基準」）。
 *   本番では店舗ごとにDBから来る。ここにあるのは飲食1業態の初期値。
 */

export type TopicTag = {
  id: string;
  label: string;
  /** この話題を選んだときに本文欄へ出す問い。3つから1つを回す */
  questions: [string, string, string];
};

/** 何も選んでいないときの問い */
export const DEFAULT_QUESTIONS: [string, string, string] = [
  "今日、何がいちばん心に残りましたか？",
  "今日、どんなことがありましたか？",
  "いちばん覚えているのは、どの場面ですか？",
];

export const TOPIC_TAGS: TopicTag[] = [
  {
    id: "food",
    label: "料理",
    questions: [
      "どの料理が、どうでしたか？",
      "今日頼んだのは何でしたか？",
      "それは、どんな感じでしたか？",
    ],
  },
  {
    id: "drink",
    label: "ドリンク",
    questions: [
      "何を飲みましたか？ どうでしたか？",
      "飲みものは、どんな感じでしたか？",
      "どれを頼みましたか？",
    ],
  },
  {
    id: "service",
    label: "接客",
    questions: [
      "接客で、どんなことがありましたか？",
      "どんな場面のことですか？",
      "何があったか、覚えていますか？",
    ],
  },
  {
    id: "atmosphere",
    label: "店内の雰囲気",
    questions: [
      "店内は、どんな感じでしたか？",
      "どのあたりが印象に残りましたか？",
      "席や広さは、どうでしたか？",
    ],
  },
  {
    id: "wait",
    label: "待ち時間",
    questions: [
      "どの場面で、どのくらい待ちましたか？",
      "いつ、どのくらいでしたか？",
      "どこで待ちましたか？",
    ],
  },
  {
    id: "price",
    label: "値段",
    questions: [
      "値段について、どう感じましたか？",
      "何の値段のことですか？",
      "どのあたりが気になりましたか？",
    ],
  },
  {
    id: "clean",
    label: "清潔さ",
    questions: [
      "清潔さについて、どう感じましたか？",
      "どこのことですか？",
      "何が気になりましたか？",
    ],
  },
];

export function topicTag(id: string): TopicTag | undefined {
  return TOPIC_TAGS.find((t) => t.id === id);
}

/**
 * 本文欄に出す問いを決める。**純粋関数**（同じ入力なら同じ出力。AIを呼ばない）。
 *
 * @param selectedIds 選ばれている話題タグ。**最初に選んだもの**の問いを出す
 * @param rotation    セッションごとに1度だけ決める 0〜2 の数。同じ問いが並ばないようにする
 */
export function questionFor(selectedIds: string[], rotation: number): string {
  const first = selectedIds[0];
  const tag = first ? topicTag(first) : undefined;
  const questions = tag ? tag.questions : DEFAULT_QUESTIONS;
  const index = ((rotation % questions.length) + questions.length) % questions.length;
  return questions[index];
}
