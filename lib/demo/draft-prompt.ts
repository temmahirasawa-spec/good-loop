import "server-only";
import type { FollowupReason } from "./draft-prompt-types";
export type { FollowupReason };

/**
 * アンケート v2 プロトタイプの生成プロンプト（docs/specs/survey-v2.md §12）。
 *
 * ⚠ **プロンプトの文面は CLAUDE.md 3章の「止まって確認する」項目。**
 * 2026-08-28、canonical fact model 版を天真に提示し承認済み。
 *
 * 設計の芯:
 *   ・入力は id 付きの「事実の一覧」だけ。**★（総合評価）は一切渡さない**（集計専用）
 *   ・出力は JSON。**各文に sourceSignalIds（根拠の事実id）が必須**
 *   ・意味の拡張禁止（「厚みがあった」→「食べ応えがあった」にしない）
 *   ・文体で変えてよいのは語尾・敬語・接続・文の長さだけ
 *   ・検証はクライアント側の validateSentences（lib/demo/fact-model.ts）が行い、
 *     通らなければ生成全体を捨てて直前の正常な文章を維持する
 */

/** 章の途中の整文（速さ優先） */
export const REFINE_MODEL = "claude-haiku-4-5-20251001";
export const REFINE_MAX_TOKENS = 900;
/** 最後の仕上げ（質優先） */
export const FINAL_MODEL = "claude-sonnet-5";
// 事実が多いと sourceSignalIds を含むJSONが長くなる。足りないと途中で切れて生成が丸ごと落ちる
export const FINAL_MAX_TOKENS = 1600;

export const REFINE_SYSTEM_PROMPT = `あなたは、お客様がアンケートで選んだ内容を、その人が書いたような自然な文章に整えます。

入力は「事実の一覧」です。各事実には id が付いています。

絶対に守ること:
- 事実の一覧にあることだけを書く。一覧に無い事実・感情・評価・頻度・因果関係を足さない
- **渡された事実は、不自然にならない範囲ですべて使う**
  （お客様がわざわざ選んだ内容なので、落とすと「選んだのに反映されない」と感じられる）
- ただし**箇条書きのように並べない**。関係のある事実はまとめて1文にし、読める文章にする
- **[必須] と書かれた事実は、どんな場合でも必ず使う**
- 意味を拡張しない（「厚みがあった」を「食べ応えがあった」にしない。「落ち着いて過ごせた」を「ゆっくり食事を楽しめた」にしない。「びっくり」「毎回」など、事実に無い強調も足さない）
- お客様が自分で書いた言葉（isFree）は、語彙と言い回しをできるだけそのまま残す
- 関係のある事実はまとめて1文にしてよい。箇条書きのような羅列にしない
- 謝罪・説明・質問・メタ発言を出力しない。書けない場合は {"sentences": []} を返す

出力は次のJSONだけ（前置き・コードブロック記号なし）:
{"sentences": [{"text": "文", "sourceSignalIds": ["根拠のid"]}]}
- 各文の sourceSignalIds には、その文の根拠になった事実の id を**すべて**入れる
- 根拠の無い文を作らない

文体の指定があるとき、変えてよいのは語尾・敬語のレベル・接続表現・文の長さだけ。事実・感情・評価・頻度・因果関係・商品の特徴は変えない。`;

export type SignalInput = {
  id: string;
  label: string;
  itemLabel?: string;
  isFree?: boolean;
  required?: boolean;
};

/**
 * 文章の構成（2026-08-28 修正仕様）。**事実は変えず、順番と長さだけを変える。**
 * variant は回答から決めて固定し、「別の言い方にする」でだけ切り替える
 * （同じ操作中に勝手に順序が変わらないようにするため）。
 */
export const DRAFT_VARIANTS = [
  "商品のことから書き始めてください。",
  "店内の印象から書き始めてください。",
  "いちばん印象に残った点から書き始めてください。",
  "気になった点から書き始め、良かった点を続けてください。",
  "1〜2文の短い口コミにしてください。",
  "3〜4文の、少し詳しい口コミにしてください。",
];

export function buildRefineUserPrompt(input: {
  signals: SignalInput[];
  previousText: string;
  tone: "normal" | "casual";
  seed: number;
  mode: "refine" | "final";
}): string {
  const lines: string[] = [];
  lines.push("事実の一覧:");
  for (const s of input.signals) {
    const item = s.itemLabel ? `（品名: ${s.itemLabel}）` : "";
    const free = s.isFree ? "（お客様が自分で書いた言葉。そのまま残す）" : "";
    const must = s.required ? " [必須]" : "";
    lines.push(`- [${s.id}] ${s.label}${item}${free}${must}`);
  }
  lines.push("");
  if (input.mode === "refine" && input.previousText) {
    lines.push(`ここまでの文章（出力に含めない。これに自然につながる続きだけを書く）:\n${input.previousText}`);
    lines.push("");
  }
  lines.push(
    input.tone === "casual"
      ? "文体: 友人に話すような、ですます調ではない砕けた書き方。"
      : "文体: ですます調の、ふつうの丁寧さ。"
  );
  lines.push(DRAFT_VARIANTS[Math.abs(input.seed) % DRAFT_VARIANTS.length]);
  lines.push("");
  lines.push(
    input.mode === "final"
      ? "上の事実だけを使って、クチコミの下書き全体をJSONで出力してください。"
      : "上の事実だけを使って、この部分の文をJSONで出力してください。"
  );
  return lines.join("\n");
}

/* ── 品の感想の選択肢（AIが品名から作る） ─────────────── */

export const CHOICES_MODEL = REFINE_MODEL;
export const CHOICES_MAX_TOKENS = 400;

export const CHOICES_SYSTEM_PROMPT = `あなたは、飲食店のアンケートの選択肢を設計します。
渡された料理・ドリンクについて、お客様が「そうそう、これ」とタップできる感想の選択肢を作ります。

絶対に守ること:
- **その品で実際に起こりうる事実だけ**にする（サラダに「ふわふわ」を出さない）
- **味・食感・温度・量・見た目・香り**の軸から作る
- **肯定・中立・否定をバランスさせる**。否定ばかり・肯定ばかりに偏らせない
  （例: 「甘さがちょうどよかった」と「甘すぎた」の両方を入れる、など）
- 事実型にする。「感動した」「幸せ」のような感情の言葉は使わない
- 宣伝文句・検索ワードのような言葉を入れない
- 各選択肢は12文字以内

出力は次のJSONだけ（前置き・説明・コードブロック記号なし）:
{"choices": [{"label": "選択肢", "polarity": "positive"}, {"label": "選択肢", "polarity": "negative"}]}
- polarity は positive（良かったこと）か negative（気になったこと）のどちらか
- 8個作り、positive と negative の数を偏らせない`;

export function buildChoicesUserPrompt(itemLabel: string, categoryLabel: string): string {
  return `品名: ${itemLabel}（カテゴリ: ${categoryLabel}）\n\nこの品の感想の選択肢を8個、JSONで出力してください。`;
}

/* ── AI追質問（★に依存しない引き金だけ。最大2問） ─────── */

export const FOLLOWUP_MODEL = REFINE_MODEL;
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
    question: "今日の体験で、いちばん印象に残ったのはどのあたりですか？",
    choices: ["料理", "接客", "待ち時間", "店内の環境", "その他"],
  },
};

export function buildFollowupUserPrompt(signals: SignalInput[], reason: FollowupReason): string {
  const context = signals.map((s) => `- ${s.label}${s.itemLabel ? `（${s.itemLabel}）` : ""}`).join("\n");
  const why: Record<FollowupReason, string> = {
    "vague-item": "選んだ料理について、具体的な感想がまだ無い",
    "wait-detail": "「待ち時間」が気になった点として選ばれているが、どの場面の待ち時間かが分からない",
    "low-rating-unclear": "回答が少なく、体験の中身がまだ分からない",
  };
  return `ここまでの回答:\n${context}\n\n足りない情報: ${why[reason]}\n\nこの情報を補うための質問をひとつ、JSONで出力してください。`;
}
