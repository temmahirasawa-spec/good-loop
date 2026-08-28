/**
 * アンケート v2 プロトタイプのデータ（docs/specs/survey-v2.md 段1）。
 *
 * **検証用。DBには一切書き込まない。** 目的は「タップのテンポが気持ちいいか」を実機で確かめること。
 * 中身は YORKYS BRUNCH（夙川）の実コンテンツ。本番では店舗ごとにDBから来る。
 *
 * 選択肢が `label`（チップに出す短い言葉）と `sentence`（文にするときの言い方）を
 * 両方持っているのが v2 の要。**AIは断片を繋ぐだけ**という構造をプロトタイプでも守るため、
 * ここでは AI を使わずルールベースで合成する（docs/specs/survey-v2.md 6-2「入力に比例させる」）。
 */

export type Choice = {
  id: string;
  label: string;
  /**
   * 下書きに使う言い方の候補。空配列なら文章に出さない（「特になし」など）。
   *
   * **複数持つのは、同じ選択でも文章が毎回同じにならないようにするため**
   * （2026-08-28 天真「アンケートが多い割に同じような文章になる」）。
   * 本番ではここをAIが担当する。プロトタイプは候補から選ぶことで動きを確かめる。
   */
  sentences: string[];
  /**
   * カジュアルな言い方（任意）。無ければ `sentences` をそのまま使う。
   *
   * **語尾を機械的に置換する方式は捨てた**（2026-08-28）。「伺いました → 伺いた」のように
   * 日本語の活用が壊れるため。本番ではAIが担当するので問題にならないが、
   * **ルールベースでは文体変換ができない**ことがプロトタイプで実証された。
   */
  casual?: string[];
};

export type Question = {
  id: string;
  /** 見出し */
  title: string;
  /** 補足（任意） */
  note?: string;
  kind: "single" | "multi";
  choices: Choice[];
  /** 任意のテキスト欄を出すか（docs/specs/survey-v2.md 4章、2026-08-28 天真） */
  freeText?: boolean;
  /** 表示条件。未指定なら常に出す */
  showIf?: (a: Answers) => boolean;
};

export type Answers = Record<string, string[]>;
export type Texts = Record<string, string>;

export const STORE_NAME = "YORKYS BRUNCH 夙川";

/** 1問あたりの体感（進捗の「あと約◯秒」に使う） */
export const SECONDS_PER_QUESTION = 4;

const has = (a: Answers, qid: string, cid: string) => (a[qid] ?? []).includes(cid);
const ratingOf = (a: Answers): number => Number((a.rating ?? [])[0] ?? 0);

export const QUESTIONS: Question[] = [
  {
    id: "rating",
    title: "本日の体験はいかがでしたか？",
    kind: "single",
    choices: [
      { id: "5", label: "とても満足", sentences: [] },
      { id: "4", label: "満足", sentences: [] },
      { id: "3", label: "ふつう", sentences: [] },
      { id: "2", label: "やや不満", sentences: [] },
      { id: "1", label: "不満", sentences: [] },
    ],
  },
  {
    id: "visit",
    title: "今日で何回目のご来店ですか？",
    kind: "single",
    choices: [
      { id: "first", label: "初めて", sentences: ["初めて伺いました", "今回が初めての来店でした", "はじめてお邪魔しました"], casual: ["初めて行ってきた", "今回が初めての来店", "はじめてお邪魔した"] },
      { id: "few", label: "何度か来ている", sentences: ["何度か利用しています", "ときどき利用しています", "これまでに何度か伺っています"], casual: ["何度か行ってる", "ときどき行ってる", "これまでに何度か来てる"] },
      { id: "regular", label: "いつも来ている", sentences: ["いつも利用しています", "よく通っています", "常連として通っています"], casual: ["いつも行ってる", "よく通ってる", "常連として通ってる"] },
    ],
  },
  {
    id: "topics",
    title: "特に印象に残ったのは？",
    note: "いくつでも選べます",
    kind: "multi",
    choices: [
      { id: "food", label: "料理", sentences: [] },
      { id: "drink", label: "ドリンク", sentences: [] },
      { id: "service", label: "接客", sentences: [] },
      { id: "atmosphere", label: "お店の雰囲気", sentences: [] },
      { id: "wait", label: "待ち時間", sentences: [] },
      { id: "price", label: "値段", sentences: [] },
    ],
  },
  {
    id: "dish",
    title: "今日召し上がったものは？",
    note: "いくつでも選べます",
    kind: "multi",
    showIf: (a) => has(a, "topics", "food"),
    choices: [
      { id: "pancake", label: "パンケーキ", sentences: ["パンケーキ"] },
      { id: "frenchtoast", label: "フレンチトースト", sentences: ["フレンチトースト"] },
      { id: "eggsbenedict", label: "エッグベネディクト", sentences: ["エッグベネディクト"] },
      { id: "pasta", label: "パスタ", sentences: ["パスタ"] },
      { id: "other", label: "そのほか", sentences: ["料理"] },
    ],
  },
  {
    id: "dish_detail",
    title: "お料理はどうでしたか？",
    note: "いくつでも選べます",
    kind: "multi",
    freeText: true,
    showIf: (a) => (a.dish ?? []).length > 0,
    choices: [
      { id: "fluffy", label: "ふわふわだった", sentences: ["生地がふわふわでした", "驚くほどふわふわの生地でした", "ふわっとした食感が印象的でした"], casual: ["生地がふわっふわ", "びっくりするくらいふわふわ", "ふわっとした食感がよかった"] },
      { id: "melt", label: "口の中で溶けた", sentences: ["口の中で溶けるような食感でした", "口に入れるとすっと溶けていきました", "とろけるような口当たりでした"], casual: ["口の中で溶ける感じ", "口に入れるとすっと溶けた", "とろけるような口当たり"] },
      { id: "looks", label: "見た目がきれい", sentences: ["見た目もきれいでした", "盛り付けも美しかったです", "運ばれてきた瞬間から見た目が良かったです"], casual: ["見た目もきれい", "盛り付けもきれいだった", "運ばれてきた瞬間からいい感じ"] },
      { id: "amount", label: "量がちょうどよかった", sentences: ["量もちょうどよかったです", "ボリュームもちょうどよかったです", "多すぎず少なすぎない量でした"], casual: ["量もちょうどよかった", "ボリュームもちょうどいい", "多すぎず少なすぎずの量"] },
      { id: "warm", label: "できたてで温かい", sentences: ["できたてで温かい状態でした", "温かいうちに出てきました", "できたてをいただけました"], casual: ["できたてで温かかった", "温かいうちに出てきた", "できたてが食べられた"] },
      { id: "rich", label: "味が濃厚", sentences: ["味が濃厚でした", "濃厚な味わいでした", "しっかりとした濃さがありました"], casual: ["味が濃厚", "濃厚な味わい", "しっかり濃くておいしい"] },
    ],
  },
  {
    id: "service_detail",
    title: "スタッフの様子はどうでしたか？",
    note: "いくつでも選べます",
    kind: "multi",
    freeText: true,
    showIf: (a) => has(a, "topics", "service") && (a.dish ?? []).length === 0,
    choices: [
      { id: "kind", label: "感じがよかった", sentences: ["スタッフの方の感じがよかったです", "接客が感じよかったです", "スタッフの方の対応が心地よかったです"], casual: ["スタッフさんの感じがよかった", "接客が感じよかった", "対応が心地よかった"] },
      { id: "explain", label: "説明が分かりやすい", sentences: ["説明が分かりやすかったです", "メニューの説明も丁寧でした", "分かりやすく案内していただきました"], casual: ["説明が分かりやすかった", "メニューの説明も丁寧", "分かりやすく案内してくれた"] },
      { id: "quick", label: "対応が早い", sentences: ["対応が早かったです", "動きがてきぱきしていました", "対応がスムーズでした"], casual: ["対応が早かった", "動きがてきぱきしてた", "対応がスムーズ"] },
      { id: "care", label: "気配りがあった", sentences: ["細やかな気配りがありました", "さりげない気遣いが嬉しかったです", "気配りが行き届いていました"], casual: ["細やかな気配りがあった", "さりげない気遣いが嬉しかった", "気配りが行き届いてた"] },
    ],
  },
  {
    id: "atmosphere_detail",
    title: "お店の雰囲気はどうでしたか？",
    note: "いくつでも選べます",
    kind: "multi",
    freeText: true,
    showIf: (a) =>
      has(a, "topics", "atmosphere") && (a.dish ?? []).length === 0 && !has(a, "topics", "service"),
    choices: [
      { id: "calm", label: "落ち着いて過ごせた", sentences: ["落ち着いて過ごせました", "ゆっくりと過ごせる空間でした", "静かに過ごせました"], casual: ["落ち着いて過ごせた", "ゆっくりできる空間", "静かに過ごせた"] },
      { id: "roomy", label: "席がゆったり", sentences: ["席がゆったりしていました", "席の間隔にゆとりがありました", "ゆったりとした席でした"], casual: ["席がゆったりしてた", "席の間隔にゆとりがあった", "ゆったりした席"] },
      { id: "clean", label: "清潔だった", sentences: ["店内も清潔でした", "店内はきれいに保たれていました", "清潔感がありました"], casual: ["店内も清潔", "店内はきれいに保たれてた", "清潔感があった"] },
      { id: "bright", label: "明るくて気持ちいい", sentences: ["明るくて気持ちのよい店内でした", "光が入って気持ちのよい空間でした", "明るい雰囲気の店内でした"], casual: ["明るくて気持ちいい店内", "光が入って気持ちいい空間", "明るい雰囲気の店内"] },
    ],
  },
  {
    id: "concern",
    title: "少し気になったことはありますか？",
    note: "無ければ「特になし」で大丈夫です",
    kind: "multi",
    freeText: true,
    showIf: (a) => ratingOf(a) >= 4,
    choices: [
      { id: "none", label: "特になし", sentences: [] },
      { id: "wait", label: "待ち時間", sentences: ["待ち時間は少し長く感じました", "待ち時間はやや気になりました", "少し待つ時間がありました"], casual: ["待ち時間は少し長く感じた", "待ち時間はちょっと気になった", "少し待つ時間があった"] },
      { id: "seat", label: "席の間隔", sentences: ["席の間隔は少し気になりました", "席がやや近く感じました"], casual: ["席の間隔は少し気になった", "席がちょっと近く感じた"] },
      { id: "price", label: "値段", sentences: ["値段は少し高く感じました", "価格はやや高めに感じました"], casual: ["値段は少し高く感じた", "価格はちょっと高めかも"] },
      { id: "noise", label: "店内の音", sentences: ["店内の音は少し気になりました", "店内はやや賑やかでした"], casual: ["店内の音は少し気になった", "店内はちょっと賑やかだった"] },
    ],
  },
  {
    id: "positive",
    title: "良かったところもあれば教えてください",
    note: "無ければ「特になし」で大丈夫です",
    kind: "multi",
    freeText: true,
    showIf: (a) => ratingOf(a) > 0 && ratingOf(a) <= 3,
    choices: [
      { id: "none", label: "特になし", sentences: [] },
      { id: "taste", label: "料理の味", sentences: ["料理の味は良かったです", "味そのものは満足できました"], casual: ["料理の味はよかった", "味そのものは満足"] },
      { id: "service", label: "接客", sentences: ["接客は良かったです", "スタッフの方の対応は良かったです"], casual: ["接客はよかった", "スタッフさんの対応はよかった"] },
      { id: "atmosphere", label: "雰囲気", sentences: ["雰囲気は良かったです", "店内の雰囲気は好きでした"], casual: ["雰囲気はよかった", "店内の雰囲気は好き"] },
      { id: "location", label: "通いやすさ", sentences: ["通いやすい場所でした", "立地は良かったです"], casual: ["通いやすい場所", "立地はよかった"] },
    ],
  },
];

/** いま出すべき質問だけを返す */
export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}

/**
 * 文体（2026-08-28 天真の案をブラッシュアップ、実機検証で再修正）。
 *
 * 元案は「カジュアル／敬語／元気／落ち着いたトーン／絵文字を含める」の5つ。
 * 「カジュアルと元気」「敬語と落ち着いた」がそれぞれ近く、選ぶ側が迷うため
 * **プリセット ＋ 絵文字トグル（別の軸）** に整理した。
 *
 * ⚠ **プロトタイプでは2つに絞っている。** 語尾を機械的に置換する方式が
 * 「伺いました → 伺いた」のように日本語の活用を壊したため、言い方そのものを
 * データに持つ方式へ変えた（`Choice.casual`）。3つ目以降（ていねい・元気など）は
 * **本番でAIが担当する**ときに足す。ルールベースでは無理、というのが実機で得た結論。
 */
export type Tone = "normal" | "casual";

export const TONES: { id: Tone; label: string }[] = [
  { id: "normal", label: "ふつう" },
  { id: "casual", label: "カジュアル" },
];

export type DraftOptions = { tone: Tone; emoji: boolean; seed: number };

/** seed から候補を1つ選ぶ（同じ seed なら同じ結果。再生成で seed を変える） */
function pickVariant(variants: string[], seed: number, salt: number): string {
  if (variants.length === 0) return "";
  return variants[(seed * 31 + salt * 17) % variants.length];
}

/** その文体で使う言い方の候補（カジュアル版が無ければ通常の言い方を使う） */
function variantsFor(choice: Choice, tone: Tone): string[] {
  if (tone === "casual" && choice.casual && choice.casual.length > 0) return choice.casual;
  return choice.sentences;
}

/**
 * 下書きの文を組み立てる（プロトタイプ用・AI不使用）。
 *
 * **回答は下書きの「素材」であって、下書きそのものではない**
 * （2026-08-28 天真の指摘で方針を修正。回答をそのまま繋ぐと全員同じ骨格になる）。
 * 本番ではここをAIが担当し、言い回し・語順・長さを振り分ける。
 * プロトタイプは候補からの抽選で「毎回少し違う」動きだけを再現する。
 *
 * 変えてよいのは**表現**だけ。**選ばれていない事実・感情は足さない**
 * （docs/specs/survey-v2.md 6-2）。
 *
 * 返すのは文の配列。器（DraftCanvas）が1文ずつ表示するため。
 */
export function composeSentences(answers: Answers, texts: Texts, opts: DraftOptions): string[] {
  const out: string[] = [];
  const pick = (qid: string, salt: number) => {
    const q = QUESTIONS.find((x) => x.id === qid);
    if (!q) return [] as string[];
    return (answers[qid] ?? [])
      .map((cid, i) => {
        const choice = q.choices.find((c) => c.id === cid);
        if (!choice || choice.sentences.length === 0) return "";
        return pickVariant(variantsFor(choice, opts.tone), opts.seed, salt + i);
      })
      .filter(Boolean);
  };

  out.push(...pick("visit", 1));

  // 料理は「何を食べたか」＋「どうだったか」で1つのまとまりにする
  const dishes = (answers.dish ?? [])
    .map((cid) => QUESTIONS.find((q) => q.id === "dish")?.choices.find((c) => c.id === cid))
    .map((c) => (c && c.sentences.length > 0 ? c.sentences[0] : ""))
    .filter(Boolean);
  if (dishes.length > 0) {
    const joined = dishes.join("と");
    const openers =
      opts.tone === "casual"
        ? [`${joined}を頼んだ`, `${joined}を注文`, `今回は${joined}`]
        : [`${joined}をいただきました`, `${joined}を注文しました`, `今回は${joined}をいただきました`];
    out.push(pickVariant(openers, opts.seed, 7));
  }
  out.push(...pick("dish_detail", 11));
  out.push(...pick("service_detail", 23));
  out.push(...pick("atmosphere_detail", 31));
  out.push(...pick("concern", 41));
  out.push(...pick("positive", 43));

  // 本人が書いた文は清書せずそのまま置く（最優先の材料）
  const written = Object.values(texts)
    .map((v) => v.trim())
    .filter((v) => v !== "");

  const all = [...out, ...written];
  const withPeriod = all.map((sentence) => (/[。！？♪]$/.test(sentence) ? sentence : `${sentence}。`));
  if (!opts.emoji || withPeriod.length === 0) return withPeriod;

  // 絵文字は**句点の代わりに**置く。「〜でした。😊」は機械が付けた印に見える
  // （2026-08-28 天真の指摘。AIに渡すプロンプトにも同じ指示を入れてある）
  const marks = ["😊", "✨"];
  return withPeriod.map((sentence, i) =>
    i % 3 === 1 && i < marks.length * 3 ? `${sentence.replace(/。$/, "")}${marks[Math.floor(i / 3)]}` : sentence
  );
}

/**
 * AIに渡す材料を集める（選んだ内容と、本人が書いた言葉）。
 *
 * **分岐のためだけの質問は材料に含めない**（2026-08-28）。
 * 「特に印象に残ったのは？」は次に出す質問を決めるための問いなので、
 * これを材料に渡すと「料理と接客が印象に残りました」というメタな文が生まれてしまう。
 */
const ROUTING_ONLY = new Set(["topics"]);

export function collectPicked(answers: Answers, texts: Texts) {
  const picked = QUESTIONS.filter((q) => !ROUTING_ONLY.has(q.id)).map((q) => ({
    question: q.title.replace(/[？?]$/, ""),
    values: (answers[q.id] ?? [])
      .map((cid) => q.choices.find((c) => c.id === cid)?.label ?? "")
      .filter((v) => v !== "" && v !== "特になし"),
  })).filter((g) => g.values.length > 0);

  const written = Object.values(texts)
    .map((v) => v.trim())
    .filter((v) => v !== "");

  const rating = Number((answers.rating ?? [])[0] ?? 0) || null;
  return { rating, picked, written };
}
