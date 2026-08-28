/**
 * canonical fact model（docs/specs/survey-v2.md §12、2026-08-28 天真承認の修正仕様）。
 *
 * **文章へ使える事実は、本人が選んだ・書いたものだけ。** 全回答を id 付きの Signal として持ち、
 * 生成された文（Sentence）は必ず根拠の Signal id を持つ。根拠の無い文は表示しない。
 *
 * ★（総合評価）は Signal にしない＝プロンプトに一切渡さない。集計専用。
 */

export type Signal = {
  /** 例: "attr:pc-plain:厚みがあった" / "visit:few" / "free:0" */
  id: string;
  /** 選択肢のラベル、または本人が書いた文そのもの */
  label: string;
  /** ルールベースの仮文（即時表示用。AIを待たない） */
  provisional: string;
  /** 品に紐づく感想の場合の品名 */
  itemLabel?: string;
  /** 本人の自由入力か（検証の許可語彙と、「そのまま残す」指示に使う） */
  isFree?: boolean;
};

export type Sentence = {
  text: string;
  sourceSignalIds: string[];
};

/* ── 検証層（実体験ガード） ─────────────────────────── */

/**
 * ★から推測されがちな語。**本人の選択肢・自由入力に含まれない限り出力禁止**
 * （2026-08-28 実機検証で全て実際に出た／出うると確認されたもの）。
 */
const BANNED_WORDS = [
  "美味し", "おいし", "食べ応え", "びっくり", "また来たい", "また行きたい", "また利用したい",
  "おすすめ", "オススメ", "毎回", "楽しめ", "楽しい", "楽しかっ", "感動", "最高",
  "素晴らし", "ぜひ", "大満足", "満足でした", "満足しました", "幸せ",
];

/** AIの謝罪・メタ発言。1つでも含まれたら生成全体を破棄する */
const META_PATTERNS = [
  "申し訳", "すみません", "できません", "選ばれた内容", "記載されて", "指示", "出力",
  "アシスタント", "AIとして", "システム", "プロンプト", "JSON",
];

export type ValidationResult =
  | { ok: true; sentences: Sentence[] }
  | { ok: false; reason: string };

/**
 * 生成結果の検証。1つでも通らなければ生成全体を捨て、呼び出し側は直前の正常な文章を維持する。
 *
 * 1. 各文に sourceSignalIds があり、全て既知の Signal を指しているか
 * 2. 禁止語が、根拠となる Signal のラベル・自由入力に無いのに出ていないか
 * 3. 謝罪・メタ発言が無いか
 * 4. すべての Signal がどれかの文で使われているか（事実をひとつも落とさない）
 */
export function validateSentences(sentences: Sentence[], signals: Signal[]): ValidationResult {
  if (sentences.length === 0) return { ok: false, reason: "empty" };
  const known = new Map(signals.map((s) => [s.id, s]));
  const allowedText = signals.map((s) => `${s.label} ${s.itemLabel ?? ""}`).join(" ");

  for (const sentence of sentences) {
    if (!sentence.text.trim()) return { ok: false, reason: "blank-sentence" };
    if (!Array.isArray(sentence.sourceSignalIds) || sentence.sourceSignalIds.length === 0)
      return { ok: false, reason: `no-source: ${sentence.text}` };
    for (const id of sentence.sourceSignalIds) {
      if (!known.has(id)) return { ok: false, reason: `unknown-source ${id}: ${sentence.text}` };
    }
    for (const pattern of META_PATTERNS) {
      if (sentence.text.includes(pattern)) return { ok: false, reason: `meta: ${sentence.text}` };
    }
    for (const word of BANNED_WORDS) {
      if (sentence.text.includes(word) && !allowedText.includes(word))
        return { ok: false, reason: `banned "${word}": ${sentence.text}` };
    }
  }

  const used = new Set(sentences.flatMap((s) => s.sourceSignalIds));
  for (const signal of signals) {
    if (!used.has(signal.id)) return { ok: false, reason: `dropped-signal: ${signal.id}` };
  }
  return { ok: true, sentences };
}

/** fixture スクリプトからも同じ基準で検査するために公開する */
export const GUARD_WORDS = { banned: BANNED_WORDS, meta: META_PATTERNS };

/* ── 絵文字（決定論。AIを呼ばない） ──────────────────── */

const EMOJI_LAST = "😊";
const EMOJI_FIRST = "✨";

/**
 * 絵文字を規則で足す。**ON→OFFで一字一句元に戻る**ことが仕様
 * （呼び出し側は絵文字なしの本文を常に別に保持し、OFF時はそれを表示する＝構造的に可逆）。
 * 句点の代わりに文末へ置く（「〜でした。😊」にしない。2026-08-28 天真の指摘）。
 */
export function applyEmoji(text: string): string {
  const parts = text.split("。").filter((p) => p.trim() !== "");
  if (parts.length === 0) return text;
  return parts
    .map((part, i) => {
      if (i === parts.length - 1) return `${part}${EMOJI_LAST}`;
      if (i === 0 && parts.length >= 3) return `${part}${EMOJI_FIRST}`;
      return `${part}。`;
    })
    .join("");
}

/** 文の配列を表示用の本文にする */
export function joinSentences(sentences: Sentence[]): string {
  return sentences.map((s) => (/[。！？]$/.test(s.text) ? s.text : `${s.text}。`)).join("");
}
