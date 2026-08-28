"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ATMOSPHERE_CHOICES,
  CHAPTERS,
  CONCERN_CHOICES,
  EAT_NOTHING_ID,
  MENU,
  GOOD_CHOICES,
  RATING_CHOICES,
  SERVICE_CHOICES,
  STORE_NAME,
  TONES,
  VISIT_CHOICES,
  categoryOf,
  fallbackAttrsFor,
  findItem,
  labelsOf,
  type Choice,
  type Tone,
} from "@/lib/demo/survey-data";
import type { FollowupReason } from "@/lib/demo/draft-prompt-types";
import {
  applyEmoji,
  draftableSignals,
  joinSentences,
  materialChips,
  validateSentences,
  type Sentence,
  type Signal,
} from "@/lib/demo/fact-model";
import { ReviewButton } from "@/components/rating-flow/Button";
import { AiSparkleIcon, CheckCircleOutlineIcon, RefreshIcon } from "@/components/rating-flow/icons";
import { DraftCanvas, useTypewriter } from "./DraftCanvas";
import { BackIcon, CheckMarkIcon, MicIcon, StopIcon } from "./icons";

/**
 * アンケート v2 プロトタイプ（docs/specs/survey-v2.md、2026-08-28 の方針転換後）。
 *
 * **検証専用。DBには書き込まない。**
 *
 * 構造（チャッピー資料＋天真の決定）:
 *   ・**縦長フォーム内の4章**（今日のこと→料理・サービス→印象に残ったこと→伝えたいこと）。
 *     ページ分割ではない。終えた章は要約になって上に残り、「直す」で戻れる
 *   ・上部に**現在の章名＋「あと◯章・約◯秒」**（「2/4」だけより負担が正確に伝わる）
 *   ・**商品と感想は item 単位で紐づける**（複数選んだら「特に印象に残った1品」を先に聞く）
 *   ・章を終えるたびに Haiku が続きを書き足し、最後に Sonnet が全体を整える
 *   ・**AI追質問は情報が足りないときだけ最大2問**（具体性不足・矛盾・「その他」）。
 *     目的は本人の体験の特定。MEOワードを言わせることではない
 */

type Phase = "chapters" | "draft" | "destination" | "done";
type Destination = "google" | "store";

/**
 * 選んだ言葉を Living Draft へ飛ばす関数を配る（2026-08-28）。
 * 呼び出し箇所が多いため context で渡す。器が画面外なら飛ばさず、
 * Draft側の短いハイライトだけにする。
 */
const FlyContext = createContext<((el: HTMLElement, label: string) => void) | null>(null);

/** 端末を短く震わせる（対応していない端末では何も起きない） */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

type Followup = { reason: FollowupReason; chapter: number; question: string; choices: string[] };

export function DemoSurvey() {
  /* ── 回答 ─────────────────────────────── */
  const [rating, setRating] = useState<string | null>(null);
  const [visit, setVisit] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<string[]>([]);
  const [attrNote, setAttrNote] = useState("");
  const [service, setService] = useState<string[]>([]);
  const [atmosphere, setAtmosphere] = useState<string[]>([]);
  const [good, setGood] = useState<string[]>([]);
  const [concern, setConcern] = useState<string[]>([]);
  const [concernNote, setConcernNote] = useState("");
  const [freeText, setFreeText] = useState("");
  const [followupQA, setFollowupQA] = useState<{ question: string; answer: string; chapter: number }[]>([]);

  /* ── 進行 ─────────────────────────────── */
  const [phase, setPhase] = useState<Phase>("chapters");
  const [expanded, setExpanded] = useState(false);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const askedReasonsRef = useRef<Set<string>>(new Set());

  /* ── 生成 ─────────────────────────────── */
  const [tone, setTone] = useState<Tone>("normal");
  const [emoji, setEmoji] = useState(false);
  const [seed, setSeed] = useState(1);
  const [chapterDrafts, setChapterDrafts] = useState<Record<number, Sentence[]>>({});
  const [finalText, setFinalText] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  /** 直近で言葉になった句（イエローの下線が走る対象） */
  const [freshText, setFreshText] = useState("");

  const ateNothing = categories.includes(EAT_NOTHING_ID);
  const effectiveFocus = items.length === 1 ? items[0] : focusItem;
  const focusLabel = effectiveFocus ? findItem(effectiveFocus)?.label ?? "" : "";

  /* ── 進行の単位（2026-08-28 修正仕様） ───────────────
     single は選んだら次へ。multiple は**自分で「選び終わった」と決める**まで進まない。
     「いくつでも選べます」と言いながら1つで先へ送ると、1つ選べば終わりだと受け取られるため。 */
  /** 飛んでいる最中のゴーストチップ（最大3件。連続タップでも重くしない） */
  const [flights, setFlights] = useState<{ key: number; label: string; x: number; y: number; dx: number; dy: number }[]>([]);
  const flightKeyRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  /** 器の中で chip が並ぶ場所。ここへ吸い込む */
  const chipZoneRef = useRef<HTMLDivElement>(null);
  /** 直近に器へ届いた語句（一瞬だけ光る） */
  const [freshChips, setFreshChips] = useState<string[]>([]);

  const flyToDraft = useCallback((el: HTMLElement, label: string) => {
    setFreshChips((prev) => (prev.includes(label) ? prev : [...prev, label]));
    window.setTimeout(() => setFreshChips((prev) => prev.filter((l) => l !== label)), 1200);

    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // 実際に chip が並ぶ場所（器の中の末尾）へ向かわせる。
    // 器の左上へ飛ばすと「左下に移動したのに右下に文章が現れる」不自然さが出るため。
    const landing = chipZoneRef.current?.getBoundingClientRect();
    const target = landing ?? canvasRef.current?.getBoundingClientRect();
    if (!target) return;
    if (target.top > window.innerHeight || target.bottom < 0) return;
    const from = el.getBoundingClientRect();
    const key = ++flightKeyRef.current;
    setFlights((prev) => [
      ...prev.slice(-2),
      {
        key,
        label,
        x: from.left,
        y: from.top,
        // chip 列の末尾（＝次に増える位置）を狙う
        dx: Math.min(target.right - 40, target.left + 12) - from.left,
        dy: target.top + Math.min(target.height / 2, 20) - from.top,
      },
    ]);
    window.setTimeout(() => setFlights((prev) => prev.filter((f) => f.key !== key)), 700);
  }, []);

  const [doneSteps, setDoneSteps] = useState<string[]>([]);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTargetRef = useRef<string | null>(null);

  const isDone = (id: string) => doneSteps.includes(id);

  /** 一区切りついた。次の未回答へスクロールし、章の進捗もここで進む */
  function finishStep(id: string) {
    setEditingStep(null);
    setDoneSteps((prev) => (prev.includes(id) ? prev : [...prev, id]));
    scrollTargetRef.current = id;
  }

  /* ── 品の感想の選択肢（AI生成・品選択時に先読み） ── */
  const [attrChoices, setAttrChoices] = useState<Choice[] | null>(null);
  const attrCacheRef = useRef<Map<string, string[]>>(new Map());

  const fetchChoicesFor = useCallback(async (itemId: string): Promise<string[]> => {
    const cached = attrCacheRef.current.get(itemId);
    if (cached) return cached;
    const itemLabel = findItem(itemId)?.label ?? "";
    const categoryLabel = categoryOf(itemId)?.label ?? "";
    let labels: string[];
    try {
      const res = await fetch("/api/demo/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "choices", itemLabel, categoryLabel }),
      });
      const data = (await res.json()) as { choices: string[] | null };
      labels = data.choices ?? fallbackAttrsFor(itemId);
    } catch {
      labels = fallbackAttrsFor(itemId);
    }
    attrCacheRef.current.set(itemId, labels);
    return labels;
  }, []);

  useEffect(() => {
    items.forEach((id) => void fetchChoicesFor(id));
  }, [items, fetchChoicesFor]);

  useEffect(() => {
    if (!effectiveFocus) {
      setAttrChoices(null);
      return;
    }
    setAttrs([]);
    setAttrChoices(null);
    let cancelled = false;
    void fetchChoicesFor(effectiveFocus).then((labels) => {
      if (!cancelled) setAttrChoices(labels.map((label) => ({ id: label, label })));
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveFocus, fetchChoicesFor]);

  /* ── canonical fact model ───────────────────── */

  const chapterSignalsList: Signal[][] = [
    // 章1 今日のこと。**来店回数は includeInDraft: false**（毎回「初めて伺いました」で始まらないように）
    visit
      ? [
          {
            id: `visit:${visit}`,
            label: labelsOf(VISIT_CHOICES, [visit])[0] ?? "",
            provisional: VISIT_CHOICES.find((c) => c.id === visit)?.provisional ?? "",
            includeInDraft: false,
          },
        ]
      : [],
    // 章2 料理・サービス
    [
      ...categories
        .filter((c) => c !== EAT_NOTHING_ID)
        .map((c) => {
          const category = MENU.find((m) => m.id === c);
          const hasItem = items.some((i) => category?.items.some((x) => x.id === i));
          return {
            id: `cat:${c}`,
            label: category?.label ?? "",
            provisional: category?.label ?? "",
            // 品まで選ばれていれば、文章の材料は品名の方を使う（重複を避ける）
            includeInDraft: !hasItem,
          };
        }),
      ...(ateNothing ? [{ id: "cat:nothing", label: "食べていない", provisional: "食べていない", includeInDraft: false }] : []),
      ...items.map((id) => ({
        id: `item:${id}`,
        label: findItem(id)?.label ?? "",
        provisional: findItem(id)?.label ?? "",
        itemLabel: findItem(id)?.label ?? "",
        // 印象に残った1品は必須。それ以外の品は任意（全部並べない）
        required: id === effectiveFocus,
        includeInDraft: id === effectiveFocus || items.length <= 2,
      })),
      ...attrs
        .filter((a) => a !== "その他")
        .map((label) => ({
          id: `attr:${effectiveFocus}:${label}`,
          label,
          provisional: label,
          itemLabel: focusLabel,
          required: true,
        })),
      ...(attrNote.trim() ? [{ id: "free:attr", label: attrNote.trim(), provisional: attrNote.trim(), isFree: true, required: true }] : []),
      ...service
        .filter((id) => id !== "none")
        .map((id) => {
          const c = SERVICE_CHOICES.find((x) => x.id === id);
          return { id: `service:${id}`, label: c?.label ?? "", provisional: c?.label ?? "" };
        }),
      ...followupQA.filter((qa) => qa.chapter === 1).map((qa, i) => ({
        id: `followup:1:${i}`,
        label: qa.answer,
        provisional: qa.answer,
        isFree: true,
        required: true,
      })),
    ],
    // 章3 印象に残ったこと（全員共通）
    [
      ...atmosphere
        .filter((id) => id !== "none")
        .map((id) => {
          const c = ATMOSPHERE_CHOICES.find((x) => x.id === id);
          return { id: `atmosphere:${id}`, label: c?.label ?? "", provisional: c?.label ?? "" };
        }),
      ...good
        .filter((id) => id !== "none")
        .map((id) => {
          const c = GOOD_CHOICES.find((x) => x.id === id);
          return { id: `good:${id}`, label: c?.label ?? "", provisional: c?.label ?? "" };
        }),
      // 気になった点は必須（不満・改善要望は落とさない）
      ...concern
        .filter((id) => id !== "none")
        .map((id) => {
          const c = CONCERN_CHOICES.find((x) => x.id === id);
          return { id: `concern:${id}`, label: c?.label ?? "", provisional: `${c?.label ?? ""}が気になった`, required: true };
        }),
      ...(concernNote.trim() ? [{ id: "free:concern", label: concernNote.trim(), provisional: concernNote.trim(), isFree: true, required: true }] : []),
      ...followupQA.filter((qa) => qa.chapter === 2).map((qa, i) => ({
        id: `followup:2:${i}`,
        label: qa.answer,
        provisional: qa.answer,
        isFree: true,
        required: true,
      })),
    ],
    // 章4 伝えたいこと
    freeText.trim() ? [{ id: "free:message", label: freeText.trim(), provisional: freeText.trim(), isFree: true, required: true }] : [],
  ];

  const allSignals = chapterSignalsList.flat();
  const signalIdsKey = chapterSignalsList.map((sig) => sig.map((x) => x.id).join(",")).join("|");

  /**
   * 章とステップの対応。進捗は**「選び終わった」を押した時にだけ**進む
   * （次の質問がDOMに現れただけでは進めない。自分で区切りをつけた感覚を作るため）。
   */
  const STEP_CHAPTER: Record<string, number> = {
    rating: 0,
    visit: 0,
    food: 1,
    focus: 1,
    attrs: 1,
    service: 1,
    atmosphere: 2,
    good: 2,
    concern: 2,
    message: 3,
  };
  /** 食事なしなら品・特徴の質問は現れないので、進捗の母数から外す */
  const skippedSteps = new Set<string>(ateNothing ? ["focus", "attrs"] : items.length > 1 ? [] : ["focus"]);
  const chapterProgress = [0, 1, 2, 3].map((chapter) => {
    const ids = Object.keys(STEP_CHAPTER).filter((id) => STEP_CHAPTER[id] === chapter);
    const done = ids.filter((id) => doneSteps.includes(id)).length;
    const total = ids.filter((id) => !skippedSteps.has(id)).length || 1;
    return Math.min(done / total, 1);
  });
  const currentChapter = Math.max(0, chapterProgress.findIndex((p) => p < 1));

  /**
   * 「選び終わった」または single の選択で一区切りついたら、次の未回答へ送る。
   * **multiple の選択そのものではスクロールしない**（1つ選んで画面が動くと、
   * 1つで終わりだと受け取られるため）。
   */
  useEffect(() => {
    const from = scrollTargetRef.current;
    if (!from) return;
    scrollTargetRef.current = null;
    const timer = setTimeout(() => {
      const order = Object.keys(STEP_CHAPTER);
      const next = order.slice(order.indexOf(from) + 1).find((id) => !doneSteps.includes(id) && stepRefs.current[id]);
      const el = next ? stepRefs.current[next] : null;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    }, 40);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneSteps]);

  /* ── 器の中身 ────────────────────────────
     整文済みの章は文章、まだの章は material chip。**不自然な仮文は出さない** */
  const refinedText = joinSentences([0, 1, 2, 3].flatMap((i) => chapterDrafts[i] ?? []));
  const refinedIds = new Set([0, 1, 2, 3].flatMap((i) => (chapterDrafts[i] ?? []).flatMap((s) => s.sourceSignalIds)));
  const pendingChips = materialChips(allSignals.filter((s) => !refinedIds.has(s.id)));

  /* ── AI整文（idle debounce・章単位・中断あり） ── */
  const abortRef = useRef<AbortController | null>(null);
  const versionRef = useRef(0);
  const refinedKeyRef = useRef<Record<number, string>>({});
  const callCountRef = useRef<Record<number, number>>({});

  const refineChapter = useCallback(
    async (chapter: number) => {
      const signals = draftableSignals(chapterSignalsList[chapter] ?? []);
      const meaningful = signals.filter((s) => s.label !== "特になし");
      // 品名だけでは文章にならない。「どうだったか」に当たる材料が1つ以上要る
      const descriptive = meaningful.filter((s) => !s.id.startsWith("item:") && !s.id.startsWith("cat:"));
      if (meaningful.length < 2 || descriptive.length < 1) return;
      const key = meaningful.map((s) => s.id).join(",");
      if (refinedKeyRef.current[chapter] === key) return; // signal setが変わっていない
      if ((callCountRef.current[chapter] ?? 0) >= 3) return; // 章あたり最大3回
      if (edited !== null) return; // 手動編集ロック中は触らない

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const myVersion = ++versionRef.current;
      callCountRef.current[chapter] = (callCountRef.current[chapter] ?? 0) + 1;
      setRefining(true);
      try {
        const previous = joinSentences([0, 1, 2, 3].filter((i) => i < chapter).flatMap((i) => chapterDrafts[i] ?? []));
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "refine",
            signals: meaningful.map(({ id, label, itemLabel, isFree, required }) => ({ id, label, itemLabel, isFree, required })),
            previousText: previous,
            tone,
            seed,
          }),
          signal: ac.signal,
        });
        const data = (await res.json()) as { sentences: Sentence[] | null };
        if (myVersion !== versionRef.current) return; // 古い応答は破棄
        if (!data.sentences) return;
        const verdict = validateSentences(data.sentences, meaningful);
        if (!verdict.ok) {
          console.error("[demo] 整文を破棄:", verdict.reason);
          return; // material のまま。エラーは画面に出さない
        }
        refinedKeyRef.current[chapter] = key;
        setChapterDrafts((prev) => ({ ...prev, [chapter]: verdict.sentences }));
        setFreshText(joinSentences(verdict.sentences));
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.error("[demo] 整文に失敗", error);
      } finally {
        if (myVersion === versionRef.current) setRefining(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signalIdsKey, tone, seed, edited]
  );

  /** 最後の操作から700msのidleで、その章だけを整文する */
  useEffect(() => {
    if (phase !== "chapters") return;
    const timer = setTimeout(() => {
      for (const chapter of [1, 2, 3]) {
        void refineChapter(chapter);
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalIdsKey, phase]);

  /* ── AI追質問（★非依存の引き金だけ・最大2問） ── */
  useEffect(() => {
    if (phase !== "chapters" || followup) return;
    const ask = async (reason: FollowupReason, chapter: number) => {
      if (followupQA.length >= 2 || askedReasonsRef.current.has(reason)) return;
      askedReasonsRef.current.add(reason);
      try {
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "followup", reason, signals: allSignals.map(({ id, label, itemLabel }) => ({ id, label, itemLabel })) }),
        });
        const data = (await res.json()) as { question: string; choices: string[] };
        setFollowup({ reason, chapter, ...data });
      } catch {
        /* 追質問は出なくてよい */
      }
    };
    if (effectiveFocus && attrs.includes("その他")) void ask("vague-item", 1);
    else if (concern.includes("wait")) void ask("wait-detail", 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalIdsKey, phase]);

  function answerFollowup(answer: string) {
    tick();
    if (!followup) return;
    setFollowupQA([...followupQA, { question: followup.question, answer, chapter: followup.chapter }]);
    setFollowup(null);
  }

  /* ── 仕上げ（Sonnet） ── */
  const generateFinal = useCallback(
    async (opts: { tone: Tone; seed: number }) => {
      const signals = draftableSignals(allSignals).filter((s) => s.label !== "特になし");
      if (signals.length === 0) {
        setFinalText(refinedText);
        return;
      }
      setGenerating(true);
      const myVersion = ++versionRef.current;
      try {
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "final",
            signals: signals.map(({ id, label, itemLabel, isFree, required }) => ({ id, label, itemLabel, isFree, required })),
            tone: opts.tone,
            seed: opts.seed,
          }),
        });
        const data = (await res.json()) as { sentences: Sentence[] | null };
        if (myVersion !== versionRef.current) return;
        if (data.sentences) {
          const verdict = validateSentences(data.sentences, signals);
          if (verdict.ok) {
            setFinalText("");
            setTimeout(() => setFinalText(joinSentences(verdict.sentences)), 50);
            return;
          }
          console.error("[demo] 最終整文を破棄:", verdict.reason);
        }
        setFinalText((prev) => prev || refinedText);
      } catch (error) {
        console.error("[demo] 最終整文に失敗", error);
        setFinalText((prev) => prev || refinedText);
      } finally {
        setGenerating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signalIdsKey, refinedText]
  );

  useEffect(() => {
    if (phase !== "draft") return;
    void generateFinal({ tone, seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ── 表示 ─────────────────────────────── */
  const baseDraft = edited ?? finalText;
  const draft = emoji && !edited ? applyEmoji(baseDraft) : baseDraft;
  const isEdited = edited !== null;

  /** 仕上げへ進める条件：★＋（料理の感想／接客／店内／自由入力のいずれか） */
  const canFinish =
    rating !== null &&
    (attrs.length > 0 ||
      attrNote.trim() !== "" ||
      service.filter((x) => x !== "none").length > 0 ||
      atmosphere.filter((x) => x !== "none").length > 0 ||
      good.filter((x) => x !== "none").length > 0 ||
      concern.filter((x) => x !== "none").length > 0 ||
      freeText.trim() !== "");


  return (
    <FlyContext.Provider value={flyToDraft}>
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      {/* 飛んでいるゴーストチップ。操作はブロックしない */}
      {flights.map((f) => (
        <span
          key={f.key}
          aria-hidden
          className="review-fly pointer-events-none fixed z-50 rounded-[var(--product-radius-full)] px-[var(--product-space-8)] py-[2px] text-[13px] font-bold"
          style={{
            left: f.x,
            top: f.y,
            backgroundColor: "var(--review-accent-wash)",
            color: "var(--review-accent-primary)",
            ["--fly-dx" as string]: `${f.dx}px`,
            ["--fly-dy" as string]: `${f.dy}px`,
          }}
        >
          {f.label}
        </span>
      ))}
      <div
        className="sticky top-0 z-20 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pb-[var(--product-space-8)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        <p className="text-center text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {STORE_NAME}
        </p>
        {phase === "chapters" ? (
          <div className="flex w-full flex-col gap-[var(--product-space-4)]">
            <div className="flex w-full gap-[var(--product-space-4)]">
              {CHAPTERS.map((c, i) => (
                <div
                  key={c.id}
                  className="h-1 min-w-px flex-1 rounded-[var(--product-radius-full)] transition-colors duration-300"
                  style={{
                    backgroundColor:
                      i < currentChapter
                        ? "var(--review-accent-primary)"
                        : i === currentChapter
                          ? "var(--review-accent-light)"
                          : "var(--product-color-border-default)",
                  }}
                />
              ))}
            </div>
            <p className="text-[12px] font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
              {CHAPTERS[currentChapter].title}
            </p>
          </div>
        ) : null}
      </div>

      <div className={phase === "chapters" ? "flex w-full flex-1 flex-col pb-[220px]" : "flex w-full flex-1 flex-col"}>
        {phase === "chapters" ? (
          /* ── 連続インタビュー：質問が下へ追加されていく（章ごとの「次へ」は無い） ── */
          <div className="flex w-full flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)]">
            <Step
              id="rating"
              title="本日の体験はいかがでしたか？"
              summary={labelsOf(RATING_CHOICES, rating ? [rating] : []).join("")}
              done={isDone("rating")}
              editing={editingStep === "rating"}
              onEdit={() => setEditingStep("rating")}
              refs={stepRefs}
            >
              <CardList
                choices={RATING_CHOICES}
                selected={rating ? [rating] : []}
                onSelect={(id) => {
                  tick();
                  setRating(id);
                  // single は短い間を置いて次へ
                  window.setTimeout(() => finishStep("rating"), 260);
                }}
              />
            </Step>

            {isDone("rating") ? (
              <Step
                id="visit"
                title="今日で何回目のご来店ですか？"
                summary={labelsOf(VISIT_CHOICES, visit ? [visit] : []).join("")}
                done={isDone("visit")}
                editing={editingStep === "visit"}
                onEdit={() => setEditingStep("visit")}
                refs={stepRefs}
              >
                <Segmented
                  choices={VISIT_CHOICES}
                  selected={visit}
                  onSelect={(id) => {
                    tick();
                    setVisit(id);
                    window.setTimeout(() => finishStep("visit"), 260);
                  }}
                />
              </Step>
            ) : null}

            {isDone("visit") ? (
              <Step
                id="food"
                title="今日は何を召し上がりましたか？"
                note="いくつでも"
                summary={
                  ateNothing
                    ? "食べていない"
                    : items.map((id) => findItem(id)?.label ?? "").filter(Boolean).join("・") ||
                      categories.map((c) => MENU.find((m) => m.id === c)?.label ?? "").filter(Boolean).join("・")
                }
                done={isDone("food")}
                editing={editingStep === "food"}
                onEdit={() => setEditingStep("food")}
                refs={stepRefs}
                /* 子質問（品）で1つ以上選ぶまで「選び終わった」を出さない */
                canFinish={ateNothing || items.length > 0}
                onFinish={() => finishStep("food")}
                multi
              >
                <ChipGrid
                  choices={[...MENU.map((c) => ({ id: c.id, label: c.label })), { id: EAT_NOTHING_ID, label: "食べていない" }]}
                  selected={categories}
                  exclusiveId={EAT_NOTHING_ID}
                  onToggle={(id) => {
                    tick();
                    setCategories((prev) => {
                      const next = prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : id === EAT_NOTHING_ID
                          ? [EAT_NOTHING_ID]
                          : [...prev.filter((x) => x !== EAT_NOTHING_ID), id];
                      const allowed = new Set(MENU.filter((c) => next.includes(c.id)).flatMap((c) => c.items.map((i) => i.id)));
                      setItems((cur) => cur.filter((x) => allowed.has(x)));
                      return next;
                    });
                  }}
                />
                {/* 子質問は同じブロックの中に開く（カテゴリを足せば、その品もここに増える） */}
                {!ateNothing &&
                  MENU.filter((c) => categories.includes(c.id)).map((c) => (
                    <div key={c.id} className="review-rise flex w-full flex-col gap-[var(--product-space-8)]">
                      <FieldTitle title={`${c.label}、どれを？`} note="いくつでも" />
                      <ChipGrid
                        choices={c.items}
                        selected={items}
                        onToggle={(id) => {
                          tick();
                          setItems((prev) => {
                            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                            if (next.length <= 1) setFocusItem(null);
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
              </Step>
            ) : null}

            {isDone("food") && !ateNothing && items.length > 1 ? (
              <Step
                id="focus"
                title="特に印象に残った1品は？"
                summary={focusLabel}
                done={isDone("focus")}
                editing={editingStep === "focus"}
                onEdit={() => setEditingStep("focus")}
                refs={stepRefs}
              >
                <ChipGrid
                  choices={items.map((id) => findItem(id)).filter((i): i is Choice => Boolean(i))}
                  selected={focusItem ? [focusItem] : []}
                  onToggle={(id) => {
                    tick();
                    setFocusItem(id);
                    window.setTimeout(() => finishStep("focus"), 260);
                  }}
                />
              </Step>
            ) : null}

            {isDone("food") && !ateNothing && effectiveFocus && (items.length === 1 || isDone("focus")) ? (
              <Step
                id="attrs"
                title={`「${focusLabel}」はどうでした？`}
                note="いくつでも"
                summary={[...attrs.filter((a) => a !== "その他"), attrNote.trim()].filter(Boolean).join("・")}
                done={isDone("attrs")}
                editing={editingStep === "attrs"}
                onEdit={() => setEditingStep("attrs")}
                refs={stepRefs}
                canFinish={attrs.length > 0 || attrNote.trim() !== ""}
                onFinish={() => finishStep("attrs")}
                multi
              >
                {attrChoices ? (
                  <ChipGrid
                    choices={[...attrChoices, { id: "その他", label: "その他" }]}
                    selected={attrs}
                    onToggle={(id) => { tick(); setAttrs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }}
                  />
                ) : (
                  <ChoicesLoading />
                )}
                <FreeTextField value={attrNote} onChange={setAttrNote} />
              </Step>
            ) : null}

            {followup ? <FollowupCard followup={followup} onAnswer={answerFollowup} onSkip={() => setFollowup(null)} /> : null}

            {isDone("attrs") || (isDone("food") && ateNothing) ? (
              <Step
                id="service"
                title="スタッフの様子はどうでした？"
                note="いくつでも"
                summary={labelsOf(SERVICE_CHOICES, service).join("・") || (service.includes("none") ? "特になし" : "")}
                done={isDone("service")}
                editing={editingStep === "service"}
                onEdit={() => setEditingStep("service")}
                refs={stepRefs}
                canFinish={service.length > 0}
                onFinish={() => finishStep("service")}
                multi
              >
                <ChipGrid
                  choices={SERVICE_CHOICES}
                  selected={service}
                  exclusiveId="none"
                  onToggle={(id) => {
                    tick();
                    setService((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                  }}
                />
              </Step>
            ) : null}

            {isDone("service") ? (
              <Step
                id="atmosphere"
                title="お店の中はどうでした？"
                note="いくつでも"
                summary={labelsOf(ATMOSPHERE_CHOICES, atmosphere).join("・") || (atmosphere.includes("none") ? "特になし" : "")}
                done={isDone("atmosphere")}
                editing={editingStep === "atmosphere"}
                onEdit={() => setEditingStep("atmosphere")}
                refs={stepRefs}
                canFinish={atmosphere.length > 0}
                onFinish={() => finishStep("atmosphere")}
                multi
              >
                <ChipGrid
                  choices={ATMOSPHERE_CHOICES}
                  selected={atmosphere}
                  exclusiveId="none"
                  onToggle={(id) => {
                    tick();
                    setAtmosphere((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                  }}
                />
              </Step>
            ) : null}

            {isDone("atmosphere") ? (
              <Step
                id="good"
                title="良かったところがあれば教えてください"
                note="無ければ「特になし」で"
                summary={labelsOf(GOOD_CHOICES, good).join("・") || (good.includes("none") ? "特になし" : "")}
                done={isDone("good")}
                editing={editingStep === "good"}
                onEdit={() => setEditingStep("good")}
                refs={stepRefs}
                canFinish={good.length > 0}
                onFinish={() => finishStep("good")}
                multi
              >
                <ChipGrid
                  choices={GOOD_CHOICES}
                  selected={good}
                  exclusiveId="none"
                  onToggle={(id) => {
                    tick();
                    setGood((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                  }}
                />
              </Step>
            ) : null}

            {isDone("good") ? (
              <Step
                id="concern"
                title="気になったところがあれば教えてください"
                note="無ければ「特になし」で"
                summary={[...labelsOf(CONCERN_CHOICES, concern), concernNote.trim()].filter(Boolean).join("・") || (concern.includes("none") ? "特になし" : "")}
                done={isDone("concern")}
                editing={editingStep === "concern"}
                onEdit={() => setEditingStep("concern")}
                refs={stepRefs}
                canFinish={concern.length > 0}
                onFinish={() => finishStep("concern")}
                multi
              >
                <ChipGrid
                  choices={CONCERN_CHOICES}
                  selected={concern}
                  exclusiveId="none"
                  onToggle={(id) => {
                    tick();
                    setConcern((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                  }}
                />
                <FreeTextField value={concernNote} onChange={setConcernNote} />
              </Step>
            ) : null}

            {isDone("concern") ? (
              <Step
                id="message"
                title="ほかに伝えたいことがあれば"
                note="なくても大丈夫です"
                summary={freeText.trim()}
                done={isDone("message")}
                editing={editingStep === "message"}
                onEdit={() => setEditingStep("message")}
                refs={stepRefs}
                canFinish
                finishLabel="書き終わった ↓"
                onFinish={() => finishStep("message")}
                multi
              >
                <FreeTextField value={freeText} onChange={setFreeText} rows={3} placeholder="そのままの言葉でどうぞ（任意）" />
              </Step>
            ) : null}

            {/* 感想が成立するまでは出さない（常時disabledは「まだ終われない」圧になる） */}
            {canFinish ? (
              <div className="review-rise flex w-full flex-col items-center pb-[var(--product-space-16)] pt-[var(--product-space-8)]">
                <ReviewButton variant="primary" size="lg" onClick={() => { tick(); setPhase("draft"); }}>
                  この感想を仕上げる
                </ReviewButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "draft" ? (
          <DraftTools
            tone={tone}
            emoji={emoji}
            locked={isEdited}
            onTone={(t) => { tick(); setTone(t); void generateFinal({ tone: t, seed }); }}
            onEmoji={() => { tick(); setEmoji(!emoji); }}
            onRegenerate={() => { tick(); const next = seed + 1; setSeed(next); void generateFinal({ tone, seed: next }); }}
            onRestore={() => { tick(); setEdited(null); }}
            onNext={() => setPhase("destination")}
            onBack={() => setPhase("chapters")}
            canvas={<EditableCanvas value={draft} onChange={setEdited} streaming={generating} />}
          />
        ) : null}

        {phase === "destination" ? (
          <DestinationStep draft={draft} onChoose={(d) => { setDestination(d); setPhase("done"); }} />
        ) : null}

        {phase === "done" ? <DoneStep destination={destination} /> : null}
      </div>

      {phase === "chapters" ? (
        <div ref={canvasRef} className="sticky bottom-0 z-10 mx-auto w-full max-w-[390px]">
          <DraftCanvas
            text={refinedText}
            chips={pendingChips}
            busy={refining}
            freshText={freshText}
            freshChips={freshChips}
            chipZoneRef={chipZoneRef}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            emptyHint="選ぶと、ここに感想が組み上がっていきます"
          />
        </div>
      ) : null}
    </div>
    </FlyContext.Provider>
  );
}

/**
 * 質問ひとつぶんの容器（2026-08-28 修正仕様）。
 *
 * ・**single** … 選ぶと呼び出し側が短い間を置いて次へ送る
 * ・**multiple** … 1つ選んでも進まない。**本人が「選び終わった ↓」を押すまで**その場に留まる
 *   （「いくつでも選べます」と言いながら1つで送ると、1つ選べば終わりだと受け取られるため）
 * ・終えた質問は**コンパクトな要約**になり、「変更」で再展開できる（選択状態は保持）
 *
 * 「選び終わった ↓」は右寄せの小さなアウトライン。**主CTAの強さは出さない**
 * （フォーム送信・画面遷移に見せない）。
 */
function Step({
  id,
  title,
  note,
  summary,
  done,
  editing,
  onEdit,
  refs,
  multi,
  canFinish,
  onFinish,
  finishLabel = "選び終わった ↓",
  children,
}: {
  id: string;
  title: string;
  note?: string;
  summary: string;
  done: boolean;
  editing: boolean;
  onEdit: () => void;
  refs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  multi?: boolean;
  canFinish?: boolean;
  onFinish?: () => void;
  finishLabel?: string;
  children: React.ReactNode;
}) {
  if (done && !editing) {
    return (
      <div
        ref={(el) => {
          refs.current[id] = el;
        }}
        className="flex w-full scroll-mt-[92px] items-center justify-between gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid px-[var(--product-space-16)] py-[var(--product-space-8)]"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--product-color-border-default)" }}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {title}
          </span>
          <span className="truncate text-[14px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {summary || "（未回答）"}
          </span>
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 shrink-0 items-center px-[var(--product-space-8)] text-[13px] font-bold"
          style={{ color: "var(--review-accent-primary)" }}
        >
          変更
        </button>
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        refs.current[id] = el;
      }}
      className="review-rise flex w-full scroll-mt-[92px] flex-col gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{ scrollMarginBottom: 240, backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--review-accent-light)" }}
    >
      <FieldTitle title={title} note={note} />
      {children}
      {multi && canFinish ? (
        <div className="review-rise flex w-full flex-col items-end gap-[var(--product-space-4)]">
          <p className="w-full text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            ほかにも選べます。あとから変更できます
          </p>
          <button
            type="button"
            onClick={onFinish}
            className="flex h-11 items-center justify-center rounded-[var(--product-radius-full)] border-[1.5px] border-solid px-[var(--product-space-16)] transition-transform active:scale-95"
            style={{
              borderColor: "var(--review-accent-light)",
              backgroundColor: "var(--product-color-surface-white)",
              color: "var(--review-accent-primary)",
            }}
          >
            <span className="text-[13px] font-bold">{finishLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ChoicesLoading() {
  return (
    <div className="flex h-11 items-center gap-[var(--product-space-8)]">
      <AiSparkleIcon className="size-[15px] shrink-0" />
      <span className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        この商品に合わせた選択肢を準備しています
      </span>
      <span className="flex items-center gap-[3px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="review-pulse size-[5px] rounded-[var(--product-radius-full)]"
            style={{ backgroundColor: "var(--review-accent-primary)", animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

/* ── 部品 ─────────────────────────────────── */

function FieldTitle({ title, note }: { title: string; note?: string }) {
  return (
    <p className="text-[15px] font-bold leading-[1.5]" style={{ color: "var(--product-color-text-primary)" }}>
      {title}
      {note ? (
        <span className="pl-[var(--product-space-8)] text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          {note}
        </span>
      ) : null}
    </p>
  );
}

/** 単一選択のカード（★用。全幅・縦積み） */
function CardList({ choices, selected, onSelect }: { choices: Choice[]; selected: string[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-[var(--product-space-8)]">
      {choices.map((choice, i) => {
        const isSelected = selected.includes(choice.id);
        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(choice.id)}
            className="review-rise flex w-full items-center rounded-[var(--product-radius-md)] border-solid px-[var(--product-space-16)] py-[var(--product-space-12)] text-left transition-transform duration-100 active:scale-[0.975]"
            style={{
              animationDelay: `${i * 35}ms`,
              minHeight: "var(--product-touch-min)",
              backgroundColor: isSelected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
              borderWidth: isSelected ? 2 : 1.5,
              borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
            }}
          >
            <span className="text-base font-bold" style={{ color: isSelected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}>
              {choice.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 3分割の帯（来店回数用。意味に合わせてレイアウトを変える） */
function Segmented({ choices, selected, onSelect }: { choices: Choice[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="flex w-full gap-[var(--product-space-8)]">
      {choices.map((choice) => {
        const isSelected = selected === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(choice.id)}
            className="flex h-12 flex-1 items-center justify-center rounded-[var(--product-radius-md)] border-solid transition-transform duration-100 active:scale-95"
            style={{
              minHeight: "var(--product-touch-min)",
              backgroundColor: isSelected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
              borderWidth: isSelected ? 2 : 1.5,
              borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
            }}
          >
            <span className="text-sm font-bold" style={{ color: isSelected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}>
              {choice.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 複数選択のチップ（横に流して折り返す。全幅カードの縦積みにしない） */
function ChipGrid({
  choices,
  selected,
  onToggle,
  exclusiveId,
}: {
  choices: Choice[];
  selected: string[];
  onToggle: (id: string) => void;
  exclusiveId?: string;
}) {
  const fly = useContext(FlyContext);
  return (
    <div className="flex w-full flex-wrap gap-[var(--product-space-8)]">
      {choices.map((choice) => {
        const isSelected = selected.includes(choice.id);
        const quiet = choice.id === exclusiveId;
        return (
          <button
            key={choice.id}
            type="button"
            aria-pressed={isSelected}
            onClick={(e) => {
              // 選んだときだけ飛ばす（解除・「特になし」では飛ばさない）
              if (!isSelected && choice.id !== exclusiveId) fly?.(e.currentTarget, choice.label);
              onToggle(choice.id);
            }}
            className="review-rise flex items-center gap-[var(--product-space-8)] rounded-[var(--product-radius-full)] border-solid px-[var(--product-space-16)] py-[var(--product-space-8)] transition-transform duration-100 active:scale-95"
            style={{
              minHeight: "var(--product-touch-min)",
              backgroundColor: isSelected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
              borderWidth: isSelected ? 2 : 1.5,
              borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
            }}
          >
            {isSelected ? <CheckMarkIcon className="review-pop size-3.5" style={{ color: "var(--review-accent-primary)" }} /> : null}
            <span
              className="text-sm font-bold"
              style={{
                color: isSelected
                  ? "var(--review-accent-primary)"
                  : quiet
                    ? "var(--product-color-text-secondary)"
                    : "var(--product-color-text-primary)",
              }}
            >
              {choice.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 任意のテキスト欄＋音声入力の場所（機能は後段） */
function FreeTextField({
  value,
  onChange,
  rows = 2,
  placeholder = "ほかにあれば、そのままの言葉で（任意）",
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [recording, setRecording] = useState(false);
  return (
    <div className="relative w-full">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] pr-[56px] text-[15px]"
        style={{
          backgroundColor: "var(--product-color-surface-white)",
          borderColor: "var(--product-color-border-default)",
          color: "var(--product-color-text-primary)",
        }}
      />
      <button
        type="button"
        onClick={() => { tick(); setRecording(!recording); }}
        aria-label={recording ? "録音を停止" : "音声で入力"}
        className="absolute right-[var(--product-space-8)] top-[var(--product-space-8)] flex size-11 items-center justify-center rounded-[var(--product-radius-full)] transition-transform active:scale-90"
        style={{
          backgroundColor: recording ? "var(--review-accent-primary)" : "var(--review-accent-wash)",
          color: recording ? "var(--review-accent-on-primary)" : "var(--review-accent-primary)",
        }}
      >
        {recording ? <StopIcon className="size-4" /> : <MicIcon className="size-5" />}
      </button>
    </div>
  );
}

/** AI追質問のカード。情報が足りないときだけ、最大2問（docs/specs/survey-v2.md 追記） */
function FollowupCard({
  followup,
  onAnswer,
  onSkip,
}: {
  followup: { question: string; choices: string[] };
  onAnswer: (answer: string) => void;
  onSkip: () => void;
}) {
  const [other, setOther] = useState("");
  return (
    <div
      className="review-rise flex w-full flex-col gap-[var(--product-space-16)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--review-accent-primary)" }}
    >
      <div className="flex items-center gap-[var(--product-space-8)]">
        <AiSparkleIcon className="size-[15px] shrink-0" />
        <span className="text-[12px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
          ひとつだけ教えてください
        </span>
      </div>
      <p className="text-[15px] font-bold leading-[1.6]" style={{ color: "var(--product-color-text-primary)" }}>
        {followup.question}
      </p>
      <div className="flex w-full flex-wrap gap-[var(--product-space-8)]">
        {followup.choices
          .filter((c) => c !== "その他")
          .map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => onAnswer(choice)}
              className="flex items-center rounded-[var(--product-radius-full)] border-[1.5px] border-solid px-[var(--product-space-16)] py-[var(--product-space-8)] transition-transform active:scale-95"
              style={{
                minHeight: "var(--product-touch-min)",
                backgroundColor: "var(--product-color-surface-white)",
                borderColor: "var(--product-color-border-default)",
              }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {choice}
              </span>
            </button>
          ))}
      </div>
      <div className="flex w-full gap-[var(--product-space-8)]">
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="自分の言葉で答える"
          className="min-w-0 flex-1 rounded-[var(--product-radius-md)] border-[1.5px] border-solid px-[var(--product-space-12)] py-[var(--product-space-8)] text-[15px]"
          style={{
            backgroundColor: "var(--product-color-surface-white)",
            borderColor: "var(--product-color-border-default)",
            color: "var(--product-color-text-primary)",
          }}
        />
        <button
          type="button"
          disabled={other.trim() === ""}
          onClick={() => onAnswer(other.trim())}
          className="flex h-11 shrink-0 items-center justify-center rounded-[var(--product-radius-sm)] px-[var(--product-space-16)] text-sm font-bold"
          style={{
            backgroundColor: other.trim() ? "var(--review-accent-primary)" : "var(--product-color-bg-tertiary)",
            color: other.trim() ? "var(--review-accent-on-primary)" : "var(--product-color-text-muted)",
          }}
        >
          答える
        </button>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="flex h-11 items-center justify-center text-[13px] font-medium"
        style={{ color: "var(--product-color-text-muted)" }}
      >
        スキップ
      </button>
    </div>
  );
}

/** 下書き画面。操作の階層を分ける：文体=切替 / 絵文字=トグル / 別の言い方=アクション */
function DraftTools({
  tone,
  emoji,
  locked,
  onTone,
  onEmoji,
  onRegenerate,
  onRestore,
  onNext,
  onBack,
  canvas,
}: {
  tone: Tone;
  emoji: boolean;
  /** 本人が手で直した後は true。編集内容を守るため、生成系の操作を止める（2026-08-28 承認） */
  locked: boolean;
  onTone: (t: Tone) => void;
  onEmoji: () => void;
  onRegenerate: () => void;
  onRestore: () => void;
  onNext: () => void;
  onBack: () => void;
  canvas: React.ReactNode;
}) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pt-[var(--product-space-8)]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="質問に戻る"
          className="flex size-11 items-center justify-center transition-transform active:scale-90"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          <BackIcon className="size-5" />
        </button>
        <span className="size-11" />
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-4)]">
        <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          あなたの感想が、言葉になりました
        </h1>
        <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          あなたが選んだ内容だけで作っています。そのまま使っても、直しても大丈夫です
        </p>
      </div>

      {canvas}

      {locked ? (
        <div className="flex w-full items-center justify-between">
          <p className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            編集した内容を守るため、言い方の変更は止めています
          </p>
          <button
            type="button"
            onClick={onRestore}
            className="flex h-11 shrink-0 items-center px-[var(--product-space-8)] text-[12px] font-bold"
            style={{ color: "var(--review-accent-primary)" }}
          >
            AIの文に戻す
          </button>
        </div>
      ) : null}

      <div className="flex w-full items-center gap-[var(--product-space-8)]" style={locked ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
        {/* 文体：排他の切替（segmented） */}
        <div
          className="flex h-11 flex-1 rounded-[var(--product-radius-full)] border-[1.5px] border-solid p-[3px]"
          style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
        >
          {TONES.map((t) => {
            const active = t.id === tone;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTone(t.id)}
                className="flex h-full flex-1 items-center justify-center rounded-[var(--product-radius-full)]"
                style={{
                  backgroundColor: active ? "var(--review-accent-primary)" : "transparent",
                  color: active ? "var(--review-accent-on-primary)" : "var(--product-color-text-secondary)",
                }}
              >
                <span className="text-[13px] font-bold">{t.label}</span>
              </button>
            );
          })}
        </div>
        {/* 絵文字：オン/オフのトグル */}
        <button
          type="button"
          aria-pressed={emoji}
          onClick={onEmoji}
          className="flex h-11 shrink-0 items-center gap-[var(--product-space-4)] rounded-[var(--product-radius-full)] border-solid px-[var(--product-space-16)]"
          style={{
            borderWidth: emoji ? 2 : 1.5,
            borderColor: emoji ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
            backgroundColor: emoji ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
            color: emoji ? "var(--review-accent-primary)" : "var(--product-color-text-secondary)",
          }}
        >
          {emoji ? <CheckMarkIcon className="size-3.5" style={{ color: "var(--review-accent-primary)" }} /> : null}
          <span className="text-[13px] font-bold">絵文字</span>
        </button>
      </div>
      {/* 別の言い方：やり直しのアクション */}
      <button
        type="button"
        disabled={locked}
        onClick={onRegenerate}
        className="flex h-11 w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-sm)] border-[1.5px] border-solid"
        style={{
          opacity: locked ? 0.4 : 1,
          borderColor: "var(--product-color-border-default)",
          backgroundColor: "var(--product-color-surface-white)",
          color: "var(--product-color-text-secondary)",
        }}
      >
        <RefreshIcon className="size-[13px]" />
        <span className="text-[13px] font-bold">別の言い方にする</span>
      </button>

      <div className="mt-auto flex w-full flex-col items-center pb-[var(--product-space-16)] pt-[var(--product-space-8)]">
        <ReviewButton variant="primary" size="lg" onClick={onNext}>
          この内容で進む
        </ReviewButton>
      </div>
    </div>
  );
}

/** 下書き画面での器。本人が直接編集できる。生成中はタイプライター表示 */
function EditableCanvas({
  value,
  onChange,
  streaming,
}: {
  value: string;
  onChange: (v: string) => void;
  streaming: boolean;
}) {
  const { shown } = useTypewriter(value, { instant: !streaming });
  return (
    <div
      className="w-full rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--review-accent-primary)" }}
    >
      <p
        className="flex items-center gap-[var(--product-space-8)] pb-[var(--product-space-8)] text-[13px] font-bold"
        style={{ color: "var(--review-accent-primary)" }}
      >
        {streaming ? "AIが文章にしています" : "あなたの感想（タップして直せます）"}
        {streaming ? (
          <span className="flex items-center gap-[3px]" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="review-pulse size-[5px] rounded-[var(--product-radius-full)]"
                style={{ backgroundColor: "var(--review-accent-primary)", animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
        ) : null}
      </p>
      {streaming ? (
        <p className="min-h-[140px] w-full whitespace-pre-wrap text-[15px] leading-[1.9]" style={{ color: "var(--product-color-text-primary)" }}>
          {shown}
          <span
            className="review-caret ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px]"
            style={{ backgroundColor: "var(--review-accent-primary)" }}
            aria-hidden
          />
        </p>
      ) : (
        <AutoGrowTextarea value={value} onChange={onChange} />
      )}
    </div>
  );
}

/** 内容に合わせて伸び縮みする編集欄（短い文章に大きな空白を残さない） */
function AutoGrowTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 84)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      className="w-full resize-none border-none bg-transparent p-0 text-[15px] leading-[1.9] outline-none"
      style={{ color: "var(--product-color-text-primary)" }}
    />
  );
}

/**
 * 宛先を選ぶ（案I）。**全員に完全同一の1枚**（2026-08-28 天真の決定）。
 * 2つのカードは重さを揃え、**どちらが良いかを書かない。事実だけ書く**。
 */
function DestinationStep({ draft, onChoose }: { draft: string; onChoose: (d: Destination) => void }) {
  const cards: { id: Destination; title: string; note: string }[] = [
    { id: "google", title: "Googleにも投稿する", note: "Googleマップに公開されます" },
    // 「代表が直接読みます」は多店舗展開に合わないため変更（2026-08-28）
    { id: "store", title: "お店にだけ届ける", note: "お店の担当者が確認します" },
  ];
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        この感想を、どうしますか？
      </h1>
      {/* 全文を見せる（3行で切らない。自分の言葉を確かめてから宛先を選べるように） */}
      <p
        className="rounded-[var(--product-radius-md)] p-[var(--product-space-12)] text-[13px] leading-[1.8]"
        style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--product-color-text-secondary)" }}
      >
        {draft}
      </p>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onChoose(card.id)}
            className="review-rise flex w-full flex-col items-center gap-[var(--product-space-4)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid px-[var(--product-space-16)] py-[var(--product-space-24)] transition-transform active:scale-[0.98]"
            style={{
              animationDelay: `${i * 60}ms`,
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--product-color-border-default)",
            }}
          >
            <span className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              {card.title}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {card.note}
            </span>
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        どちらを選んでも、ご回答はお店に届いています
      </p>
    </div>
  );
}

function DoneStep({ destination }: { destination: Destination | null }) {
  return (
    <div className="review-rise flex w-full flex-1 flex-col items-center justify-center gap-[var(--product-space-20)] px-[var(--product-space-24)] py-[var(--product-space-40)]">
      <CheckCircleOutlineIcon className="size-16 shrink-0" />
      <p className="text-center text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        ありがとうございました
      </p>
      <p className="text-center text-sm font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
        {destination === "google"
          ? "このあとGoogleマップの投稿画面が開きます"
          : "いただいた内容は店舗責任者が確認し改善に活かしてまいります"}
      </p>
      <p className="text-center text-xs font-medium" style={{ color: "var(--product-color-text-muted)" }}>
        これは検証用のデモです。回答は保存されません
      </p>
    </div>
  );
}
