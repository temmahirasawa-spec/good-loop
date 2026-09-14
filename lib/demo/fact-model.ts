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
  /** 器に出す短い断片（material chip の文言。**文章にはしない**） */
  provisional: string;
  /** 品に紐づく感想の場合の品名 */
  itemLabel?: string;
  /** 本人の自由入力か（検証の許可語彙と、「そのまま残す」指示に使う） */
  isFree?: boolean;
  /**
   * 文章に**必ず**含める事実か（2026-08-28 修正仕様）。
   * 自由入力・音声・明確な不満や改善要望・「特に印象に残った1品」・本人が入れると指定したもの。
   */
  required?: boolean;
  /**
   * 文章の材料として渡すか。false ならプロンプトに渡さない（＝構造的に本文へ入らない）。
   * 来店回数の既定値。毎回「初めて伺いました」から始まる口コミを防ぐため。
   *
   * ⚠ **器への表示は制御しない。** 選んだ履歴は全部 chip に出る。
   */
  includeInDraft?: boolean;
  /** 良かったこと／気になったこと（器で分けて並べ、色を変える。2026-08-28） */
  polarity?: "positive" | "negative";
};

/** 文章の材料として渡す signal だけを返す */
export function draftableSignals(signals: Signal[]): Signal[] {
  return signals.filter((s) => s.includeInDraft !== false);
}

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
 * 4. **必須の Signal**（required）が使われているか。
 *    任意の signal（来店回数・全商品・一般的な店内評価など）は使わなくてよい
 *    ＝ `usedSignalIds ⊆ availableSignalIds` が守るべき条件（2026-08-28 修正仕様）。
 *    全部入れる縛りは「全回答を順番に読み上げる」口コミの原因だったため撤廃した。
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
    if (signal.required && !used.has(signal.id)) return { ok: false, reason: `dropped-required: ${signal.id}` };
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

/* ── material chip（AI整文前に器へ出す断片） ───────────── */

export type MaterialChip = { id: string; label: string; lead?: boolean; polarity?: "positive" | "negative" };

/**
 * 整文前の器に出す断片（2026-08-28 修正仕様）。
 *
 * **不自然な完成文を見せない。** 「『フレンチトースト プレーン』は、中がふわふわだった。」
 * のような仮文の代わりに、品名を見出しにして特徴を「＋ 〜」で並べる。
 *
 * ⚠ **chip は「選んだ履歴」なので、`includeInDraft` に関わらず全部出す**
 * （2026-08-28 天真の指摘：飛ぶアニメーションは出るのに器に入らないのは矛盾）。
 * `includeInDraft` は**文章の材料にするか**だけのフラグで、表示の可否ではない。
 */
export function materialChips(signals: Signal[]): MaterialChip[] {
  const lead: MaterialChip[] = [];
  const positive: MaterialChip[] = [];
  const negative: MaterialChip[] = [];
  for (const s of signals) {
    if (s.id.startsWith("item:") || s.id.startsWith("cat:")) {
      lead.push({ id: s.id, label: s.label, lead: true });
      continue;
    }
    const chip = { id: s.id, label: s.provisional || s.label, polarity: s.polarity };
    if (s.polarity === "negative") negative.push(chip);
    else positive.push(chip);
  }
  // 良かったことでまとめ、気になったことでまとめる（交互に混ざらないように）
  return [...lead, ...positive, ...negative];
}

/* ── 今日の感想（タグの整理棚。2026-08-28 の再設計） ─────── */

export type KansouGroup = { id: string; title: string; chips: MaterialChip[] };

/**
 * 回答タグを意味のまとまりへ整理する（docs/specs/survey-v2.md §18）。
 *
 * Signal の id が構造を持っている（item:/attr:/service:/…）ため、**決定論で整理できる**。
 * AIに整理させる案もあったが、待ち時間ゼロ・誤分類ゼロのこちらを採る。
 * **空のグループは返さない**（回答に応じて必要なまとまりだけが生まれる）。
 */
export function kansouGroups(signals: Signal[]): KansouGroup[] {
  const food: MaterialChip[] = [];
  const service: MaterialChip[] = [];
  const space: MaterialChip[] = [];
  const goodPoints: MaterialChip[] = [];
  const concerns: MaterialChip[] = [];
  const words: MaterialChip[] = [];

  // 品が選ばれているカテゴリは、カテゴリのタグを出さない（品名と二重になるため）。
  // ⚠ 品が無い間はカテゴリを**必ず出す**。ここを省くと「タグが飛ぶのに器に入らない」矛盾になる
  //   （2026-08-28 実機バグ。カテゴリだけ選んだ時点で器が空のままだった）
  const itemLabels = new Set(signals.filter((s) => s.id.startsWith("item:")).map((s) => s.itemLabel ?? ""));
  for (const s of signals) {
    const chip: MaterialChip = { id: s.id, label: s.provisional || s.label, polarity: s.polarity };
    if (s.id.startsWith("item:")) food.push({ ...chip, label: s.label, lead: true });
    else if (s.id.startsWith("cat:")) {
      if (s.includeInDraft !== false || itemLabels.size === 0) food.push({ ...chip, lead: true });
    }
    else if (s.id.startsWith("attr:") || s.id === "free:attr" || s.id.startsWith("followup:1")) food.push(chip);
    else if (s.id.startsWith("service:")) service.push(chip);
    else if (s.id.startsWith("atmosphere:")) space.push(chip);
    else if (s.id.startsWith("good:")) goodPoints.push(chip);
    else if (s.id.startsWith("concern:") || s.id === "free:concern" || s.id.startsWith("followup:2")) concerns.push(chip);
    else if (s.isFree) words.push(chip);
  }

  const groups: KansouGroup[] = [
    { id: "food", title: "料理", chips: food },
    { id: "service", title: "接客", chips: service },
    { id: "space", title: "店内・過ごし方", chips: space },
    { id: "good", title: "良かったこと", chips: goodPoints },
    { id: "concern", title: "気になったこと", chips: concerns },
    { id: "words", title: "ひとこと", chips: words },
  ];
  return groups.filter((g) => g.chips.length > 0);
}
