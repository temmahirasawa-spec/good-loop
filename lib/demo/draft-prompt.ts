import "server-only";

/**
 * アンケート v2 プロトタイプの下書き生成プロンプト（docs/specs/survey-v2.md 6章）。
 *
 * ⚠ **プロンプトの文面は CLAUDE.md 3章の「止まって確認する」項目。**
 * ここを変えるときは必ず天真に文面を見せること。
 *
 * ⚠ **書き方のヒントで話題を指定してはいけない**（2026-08-28、実測で判明）。
 * 「お店の雰囲気から書き始めてください」のような指示を混ぜたところ、
 * **選ばれてもいない雰囲気をAIが作り出した**（「落ち着いた雰囲気の中で」「ゆっくり過ごしながら」）。
 * ヒントは**材料の範囲内で語順・長さ・語り口だけを変える**ものに限ること。
 *
 * 2026-08-28、実機検証で「感想の羅列になっていて不自然。これではステマと言われる」
 * という指摘を受けて新設した。ルールベース合成（選んだ断片をそのまま繋ぐ）の限界が
 * 実物で確認できたため、**AIに書かせる**方式へ切り替える。
 *
 * 設計の芯:
 *   ・変えてよいのは**表現**だけ。**事実は作らない**
 *   ・**羅列にしない**（関係のあるものをまとめて1文にする）
 *   ・**入力が少なければ短く終わる**（字数を稼がない）
 *   ・**毎回ランダムに書き方の指示を混ぜる**（同じ店で似た文面が並ぶのを防ぐ）
 */

export type DraftInput = {
  rating: number | null;
  /** 選ばれた内容。質問ごとにまとめる */
  picked: { question: string; values: string[] }[];
  /** 本人が書いた文。最優先の材料 */
  written: string[];
  tone: "normal" | "casual";
  emoji: boolean;
};

/**
 * モデルの使い分け（2026-08-28、天真「タップしている最中も文章の繋がりが自然になっていくギミック」）。
 *
 * ・**live** … 質問が切り替わるたびに、続きの1〜2文を書き足す。**速さが命**なので Haiku
 * ・**final** … 全部答え終わったあとの仕上げ。**質は落とせない**ので Sonnet
 *
 * こうすると「書き足されていくのが見える」体験と「最後にきれいな文章になる」体験が両立する。
 * 途中は前の文を直せないぶん粗さが残るが、それは final で整う。
 */
export const LIVE_MODEL = "claude-haiku-4-5-20251001";
export const DRAFT_MODEL = "claude-sonnet-5";
export const DRAFT_MAX_TOKENS = 500;
export const LIVE_MAX_TOKENS = 200;

/** 続きを書き足すときのシステムプロンプト（本文は共通の制約を引き継ぐ） */
export const LIVE_SYSTEM_PROMPT = `あなたは、お客様がアンケートで選んだ内容をもとに、その人が自分で書いたように見えるクチコミの下書きを、少しずつ書き進めています。

いま渡されるのは「ここまで書いた文章」と「新しく選ばれた内容」です。

絶対に守ること:
- **すでに書いた文章は繰り返さない。続きの文だけを出力する**
- 新しく選ばれた内容だけを使う。**材料に無いことは一切書かない**
- 場面や状況を勝手に作らない（「ゆっくり過ごしながら」「友人と」など）
- 選ばれていない感情・評価・再訪意向を書かない（「大満足」「また来たい」など）
- **1〜2文だけ**。長く書かない
- 前の文と自然につながるようにする（接続詞を使ってよい）
- 前置き・説明・カギ括弧を付けない。続きの文そのものだけを出力する`;

export const DRAFT_SYSTEM_PROMPT = `あなたは、お客様がアンケートで選んだ内容をもとに、その人が自分で書いたように見えるクチコミの下書きを作ります。

絶対に守ること:
- **与えられた材料に無いことは、文章を自然にするためであっても一切書かない**
- 場面や状況を勝手に作らない（「ゆっくり過ごしながら」「落ち着いた雰囲気の中で」「友人と」「休日に」など、
  材料に無い設定を足さない）
- 選ばれていない事実（料理名・金額・時間・人数・天気・同行者）を書かない
- 選ばれていない感情・評価・再訪意向・推薦意向を書かない
  （「大満足」「最高」「忘れられない」「また来たい」「おすすめです」など。星の数は感情の根拠にしない）
- 選ばれた内容をひとつも落とさない
- 迷ったら書かない。**短くなることは失敗ではない**

書き方:
- 選ばれた内容を並べず、関係のあるものをまとめて1文にする。箇条書きのような羅列にしない
- 短くてよい。選ばれた内容が少なければ2文で終わってよい。字数を稼ぐために内容を膨らませない
- 「心温まる」「素晴らしいひととき」「ぜひまた訪れたい」のような広告のような常套句を使わない
- 完璧に整えすぎない。人が書いた文章には、少しの偏りや口語がある
- 自由記述がある場合は、その人の言葉づかいを残す

出力:
- クチコミの本文だけを書く。前置き・後書き・見出し・カギ括弧は付けない
- 自分がAIであることには触れない`;

/**
 * 書き出しと組み立てのばらつき（2026-08-28）。
 *
 * **同じ選択でも文章が似ないようにするための実体。** 生成のたびに1つ選んで混ぜる。
 * 2026-08-23の実測では、こうした振り分けで3文字組の類似度が
 * 中央値 0.32 → 0.14（半分以下）になることを確認している。
 */
const WRITING_HINTS = [
  "与えられた材料のうち、最後に挙げられたものから書き始めてください。",
  "与えられた材料を、挙げられた順のまま書いてください。",
  "全体の前置きを置かず、具体的なことから書き始めてください。",
  "2文で短くまとめてください。",
  "3文程度で、少しゆとりのある書き方にしてください。",
  "体言止めを一度だけ使ってください。",
  "話し言葉に近い、ゆるい書き出しにしてください。",
  "短い文を重ねる書き方にしてください。",
  "一文を長めにして、つなげて書いてください。",
];

export function pickWritingHint(seed: number): string {
  return WRITING_HINTS[Math.abs(seed) % WRITING_HINTS.length];
}

export function buildDraftUserPrompt(input: DraftInput, seed: number): string {
  const lines: string[] = [];

  if (input.rating) lines.push(`総合評価: ★${input.rating}`);
  for (const group of input.picked) {
    if (group.values.length > 0) lines.push(`${group.question}: ${group.values.join("、")}`);
  }
  if (input.written.length > 0) {
    lines.push(`お客様が自分で書いた言葉: ${input.written.join(" / ")}`);
  }

  lines.push("");
  lines.push(
    input.tone === "casual"
      ? "文体: 友人に話すような、ですます調ではない砕けた書き方にしてください。"
      : "文体: ですます調の、ふつうの丁寧さで書いてください。"
  );
  lines.push(
    input.emoji
      ? "絵文字: 1〜2個だけ使ってください。**句点の代わりに文末へ置き、句点の後ろには置かないでください**（「〜でした。😊」ではなく「〜でした😊」）。"
      : "絵文字: 使わないでください。"
  );
  lines.push(pickWritingHint(seed));
  lines.push("");
  lines.push("上記をもとに、クチコミの下書きを1つ書いてください。");

  return lines.join("\n");
}

/** 続きを書き足させるときの指示 */
export function buildLiveUserPrompt(
  written: string,
  newValues: { question: string; values: string[] }[],
  freeText: string[],
  tone: "normal" | "casual"
): string {
  const lines: string[] = [];
  lines.push(written ? `ここまで書いた文章:\n${written}` : "ここまで書いた文章: （まだありません）");
  lines.push("");
  lines.push("新しく選ばれた内容:");
  for (const group of newValues) {
    if (group.values.length > 0) lines.push(`- ${group.question}: ${group.values.join("、")}`);
  }
  if (freeText.length > 0) lines.push(`- お客様が自分で書いた言葉: ${freeText.join(" / ")}`);
  lines.push("");
  lines.push(
    tone === "casual"
      ? "文体: 友人に話すような、ですます調ではない砕けた書き方。"
      : "文体: ですます調の、ふつうの丁寧さ。"
  );
  lines.push("続きの文だけを書いてください。");
  return lines.join("\n");
}

/**
 * AI追質問（2026-08-28 天真の方針）。
 *
 * **AI作文を主役にせず、本人の感想を発見・具体化するためにAIを使う。**
 * 毎回は聞かない。情報が足りないとき（具体性不足・矛盾・「その他」）だけ、**最大2問**。
 * 目的は**本人の体験を特定すること**。MEOワードを口コミに入れさせることではない
 * （この線を越えると「AIっぽい感想文」「ステマ」の印象に戻る）。
 */
export const FOLLOWUP_MODEL = LIVE_MODEL;
export const FOLLOWUP_MAX_TOKENS = 300;

export const FOLLOWUP_SYSTEM_PROMPT = `あなたは、お店に来たお客様の体験を具体化するインタビュアーです。
アンケートの回答を見て、足りない情報をひとつだけ質問します。

絶対に守ること:
- 質問はひとつだけ。短く、答えやすく
- 目的はお客様の体験を特定すること。お店の宣伝になる言葉を言わせようとしない
- 特定の答えへ誘導しない。良い方向にも悪い方向にも寄せない
- 選択肢は事実を答えるためのもの。感情や評価の言葉を押しつけない

出力は次のJSONだけ（前置き・説明・コードブロック記号は付けない）:
{"question": "質問文", "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"]}
選択肢は3〜5個。最後の選択肢は「その他」にする。`;

import type { FollowupReason } from "./draft-prompt-types";
export type { FollowupReason };

/** AIが落ちたとき・変な形で返したときに使う固定の質問 */
export const FOLLOWUP_FALLBACK: Record<FollowupReason, { question: string; choices: string[] }> = {
  "vague-item": {
    question: "その料理のどんなところが印象に残りましたか？",
    choices: ["味", "食感", "見た目", "量", "その他"],
  },
  "wait-detail": {
    question: "待ち時間は、どの場面で気になりましたか？",
    choices: ["入店まで", "注文まで", "料理が届くまで", "会計", "その他"],
  },
  "low-rating-unclear": {
    question: "いちばん残念だったのは、どのあたりでしたか？",
    choices: ["料理", "接客", "待ち時間", "店内の環境", "その他"],
  },
};

export function buildFollowupUserPrompt(
  picked: { question: string; values: string[] }[],
  reason: FollowupReason
): string {
  const context = picked
    .filter((g) => g.values.length > 0)
    .map((g) => `${g.question}: ${g.values.join("、")}`)
    .join("\n");
  const why: Record<FollowupReason, string> = {
    "vague-item": "選んだ料理について、具体的な感想がまだ無い",
    "wait-detail": "評価は高いのに「待ち時間」が気になった点として選ばれている。どの場面の待ち時間かが分からない",
    "low-rating-unclear": "評価が低いのに、何が悪かったのかが選ばれていない",
  };
  return `ここまでの回答:\n${context}\n\n足りない情報: ${why[reason]}\n\nこの情報を補うための質問をひとつ、JSONで出力してください。`;
}
