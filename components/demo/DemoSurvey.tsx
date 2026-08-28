"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { applyEmoji, joinSentences, validateSentences, type Sentence, type Signal } from "@/lib/demo/fact-model";
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
  const [chapterIndex, setChapterIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("chapters");
  const [expanded, setExpanded] = useState(false);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const askedReasonsRef = useRef<Set<string>>(new Set());

  /* ── 生成 ─────────────────────────────── */
  const [tone, setTone] = useState<Tone>("normal");
  const [emoji, setEmoji] = useState(false);
  const [seed, setSeed] = useState(1);
  /** 章ごとの文。provisional（ルールベース）→ refined（AI整文）に置き換わる */
  const [chapterDrafts, setChapterDrafts] = useState<Record<number, { sentences: Sentence[]; refined: boolean }>>({});
  /** 最終画面の文章（Sonnetの整文。検証を通ったものだけが入る） */
  const [finalText, setFinalText] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const ateNothing = categories.includes(EAT_NOTHING_ID);
  const effectiveFocus = items.length === 1 ? items[0] : focusItem;
  const focusLabel = effectiveFocus ? findItem(effectiveFocus)?.label ?? "" : "";

  /* ── 品の感想の選択肢（AI生成。カテゴリ選択時点で先読みする） ── */
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

  // 品を選んだ時点で先読み（対象を決める頃には表示できるように）
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

  /* ── canonical fact model：章ごとの Signal を導出 ─────── */

  const chapterSignalsList: Signal[][] = [
    // 章1 今日のこと（★は Signal にしない＝集計専用）
    visit
      ? [{ id: `visit:${visit}`, label: labelsOf(VISIT_CHOICES, [visit])[0] ?? "", provisional: VISIT_CHOICES.find((c) => c.id === visit)?.provisional ?? "" }]
      : [],
    // 章2 料理・サービス
    [
      ...items.map((id) => ({
        id: `item:${id}`,
        label: findItem(id)?.label ?? "",
        provisional: "",
        itemLabel: findItem(id)?.label ?? "",
      })),
      ...attrs
        .filter((a) => a !== "その他")
        .map((label) => ({
          id: `attr:${effectiveFocus}:${label}`,
          label,
          provisional: `「${focusLabel}」は、${label}`,
          itemLabel: focusLabel,
        })),
      ...(attrNote.trim() ? [{ id: "free:attr", label: attrNote.trim(), provisional: attrNote.trim(), isFree: true }] : []),
      ...service
        .filter((id) => id !== "none")
        .map((id) => {
          const c = SERVICE_CHOICES.find((x) => x.id === id);
          return { id: `service:${id}`, label: c?.label ?? "", provisional: c?.provisional ?? "" };
        }),
      ...followupQA.filter((qa) => qa.chapter === 1).map((qa, i) => ({
        id: `followup:1:${i}`,
        label: `${qa.question} → ${qa.answer}`,
        provisional: qa.answer,
        isFree: true,
      })),
    ],
    // 章3 印象に残ったこと（全員共通の2問）
    [
      ...atmosphere
        .filter((id) => id !== "none")
        .map((id) => {
          const c = ATMOSPHERE_CHOICES.find((x) => x.id === id);
          return { id: `atmosphere:${id}`, label: c?.label ?? "", provisional: c?.provisional ?? "" };
        }),
      ...good
        .filter((id) => id !== "none")
        .map((id) => {
          const c = GOOD_CHOICES.find((x) => x.id === id);
          return { id: `good:${id}`, label: c?.label ?? "", provisional: c?.provisional ?? "" };
        }),
      ...concern
        .filter((id) => id !== "none")
        .map((id) => {
          const c = CONCERN_CHOICES.find((x) => x.id === id);
          return { id: `concern:${id}`, label: c?.label ?? "", provisional: c?.provisional ?? "" };
        }),
      ...(concernNote.trim() ? [{ id: "free:concern", label: concernNote.trim(), provisional: concernNote.trim(), isFree: true }] : []),
      ...followupQA.filter((qa) => qa.chapter === 2).map((qa, i) => ({
        id: `followup:2:${i}`,
        label: `${qa.question} → ${qa.answer}`,
        provisional: qa.answer,
        isFree: true,
      })),
    ],
    // 章4 伝えたいこと
    freeText.trim() ? [{ id: "free:message", label: freeText.trim(), provisional: freeText.trim(), isFree: true }] : [],
  ];

  /** 章の仮文（ルールベース・即時。品は1文にまとめる） */
  function provisionalFor(chapter: number): Sentence[] {
    const signals = chapterSignalsList[chapter];
    const out: Sentence[] = [];
    if (chapter === 1) {
      const itemSignals = signals.filter((s) => s.id.startsWith("item:"));
      if (itemSignals.length > 0) {
        out.push({
          text: `${itemSignals.map((s) => s.label).join("と")}をいただきました`,
          sourceSignalIds: itemSignals.map((s) => s.id),
        });
      }
    }
    for (const s of signals) {
      if (s.id.startsWith("item:")) continue;
      if (s.provisional) out.push({ text: s.provisional, sourceSignalIds: [s.id] });
    }
    return out;
  }

  /**
   * 選択が変わった瞬間に、その章の文を仮文で組み直す（Living Draft の即時反映）。
   * 追加は末尾に足されるのでタイピング演出になり、解除は演出なしで消える。
   * **他の章の文（refined 含む）には触れない。**
   */
  const signalIdsKey = chapterSignalsList.map((sig) => sig.map((x) => x.id).join(",")).join("|");
  const prevIdsRef = useRef<string[]>(["", "", "", ""]);
  useEffect(() => {
    const idsByChapter = chapterSignalsList.map((sig) => sig.map((x) => x.id).join(","));
    idsByChapter.forEach((ids, chapter) => {
      if (prevIdsRef.current[chapter] === ids) return;
      prevIdsRef.current[chapter] = ids;
      setChapterDrafts((prev) => ({ ...prev, [chapter]: { sentences: provisionalFor(chapter), refined: false } }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalIdsKey]);

  /** 章1〜nまでの本文（表示用） */
  function textUpTo(chapter: number): string {
    const all: Sentence[] = [];
    for (let i = 0; i <= chapter; i++) all.push(...(chapterDrafts[i]?.sentences ?? []));
    return joinSentences(all);
  }
  const liveText = textUpTo(3);

  /* ── 章の終わりにAIが整文する（非同期。失敗したら仮文のまま） ── */
  const refineChapter = useCallback(
    async (chapter: number) => {
      const signals = chapterSignalsList[chapter];
      if (signals.length === 0) return; // 事実が無ければ呼ばない（P0）
      const idsAtRequest = signals.map((s) => s.id).join(",");
      try {
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "refine",
            signals: signals.map(({ id, label, itemLabel, isFree }) => ({ id, label, itemLabel, isFree })),
            previousText: textUpTo(chapter - 1),
            tone,
            seed,
          }),
        });
        const data = (await res.json()) as { sentences: Sentence[] | null };
        if (!data.sentences) return;
        const verdict = validateSentences(data.sentences, signals);
        if (!verdict.ok) {
          console.error("[demo] 整文を破棄:", verdict.reason);
          return; // 仮文を維持（エラーは画面に出さない）
        }
        // リクエスト後に回答が変わっていたら捨てる（古い整文で上書きしない）
        if (chapterSignalsList[chapter].map((s) => s.id).join(",") !== idsAtRequest) return;
        setChapterDrafts((prev) => ({ ...prev, [chapter]: { sentences: verdict.sentences, refined: true } }));
      } catch (error) {
        console.error("[demo] 整文に失敗", error);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signalIdsKey, tone, seed, chapterDrafts]
  );

  /* ── AI追質問（★に依存しない引き金だけ。最大2問） ── */
  function detectFollowupReason(justFinished: number): FollowupReason | null {
    if (followupQA.length >= 2) return null;
    if (justFinished === 1 && effectiveFocus && (attrs.includes("その他") || (attrs.length === 0 && attrNote.trim() === "")) && !askedReasonsRef.current.has("vague-item"))
      return "vague-item";
    if (justFinished === 2 && concern.includes("wait") && !askedReasonsRef.current.has("wait-detail"))
      return "wait-detail";
    return null;
  }

  async function maybeAskFollowup(justFinished: number): Promise<boolean> {
    const reason = detectFollowupReason(justFinished);
    if (!reason) return false;
    askedReasonsRef.current.add(reason);
    try {
      const res = await fetch("/api/demo/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "followup",
          reason,
          signals: chapterSignalsList.flat().map(({ id, label, itemLabel }) => ({ id, label, itemLabel })),
        }),
      });
      const data = (await res.json()) as { question: string; choices: string[] };
      setFollowup({ reason, chapter: justFinished, ...data });
      return true;
    } catch {
      return false;
    }
  }

  /** 章を終える。質問は次の画面へ進み、整文は後ろで進む */
  async function completeChapter() {
    tick();
    void refineChapter(chapterIndex);
    const asked = await maybeAskFollowup(chapterIndex);
    if (asked) return;
    advance();
  }

  function advance() {
    if (chapterIndex + 1 >= CHAPTERS.length) {
      setPhase("draft");
      return;
    }
    setChapterIndex(chapterIndex + 1);
  }

  function answerFollowup(answer: string) {
    tick();
    if (!followup) return;
    setFollowupQA([...followupQA, { question: followup.question, answer, chapter: followup.chapter }]);
    const target = followup.chapter;
    setFollowup(null);
    setTimeout(() => void refineChapter(target), 0);
    advance();
  }

  function skipFollowup() {
    setFollowup(null);
    advance();
  }

  /** 終えた章を直す。**文章は消さない**（その章の回答を変えた時だけ、その章の文が組み直る） */
  function reopenChapter(i: number) {
    tick();
    setChapterIndex(i);
  }

  /* ── 最終の仕上げ（Sonnet・全事実から） ── */
  const generateFinal = useCallback(
    async (opts: { tone: Tone; seed: number }) => {
      const signals = chapterSignalsList.flat();
      if (signals.length === 0) {
        setFinalText(liveText);
        return;
      }
      setGenerating(true);
      try {
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "final",
            signals: signals.map(({ id, label, itemLabel, isFree }) => ({ id, label, itemLabel, isFree })),
            tone: opts.tone,
            seed: opts.seed,
          }),
        });
        const data = (await res.json()) as { sentences: Sentence[] | null };
        if (data.sentences) {
          const verdict = validateSentences(data.sentences, signals);
          if (verdict.ok) {
            setFinalText("");
            // 一拍おいてから流し込む（空→全文でタイピング演出になる）
            setTimeout(() => setFinalText(joinSentences(verdict.sentences)), 50);
            return;
          }
          console.error("[demo] 最終整文を破棄:", verdict.reason);
        }
        // 失敗時：直前の正常な文章（章ごとの文）を維持。エラー文は出さない
        setFinalText((prev) => prev || liveText);
      } catch (error) {
        console.error("[demo] 最終整文に失敗", error);
        setFinalText((prev) => prev || liveText);
      } finally {
        setGenerating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signalIdsKey, liveText]
  );

  useEffect(() => {
    if (phase !== "draft") return;
    void generateFinal({ tone, seed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ── 表示 ─────────────────────────────── */
  // 絵文字は決定論で付け外しする（AIを呼ばない。OFFで一字一句元に戻る）
  const baseDraft = edited ?? finalText;
  const draft = emoji && !edited ? applyEmoji(baseDraft) : baseDraft;
  const isEdited = edited !== null;

  const attrsDone = attrs.length > 0 || attrNote.trim() !== "";
  const chapterComplete: boolean[] = [
    rating !== null && visit !== null,
    ateNothing || (items.length > 0 && (items.length === 1 || focusItem !== null) && attrsDone && service.length > 0),
    atmosphere.length > 0 && good.length > 0 && concern.length > 0,
    true,
  ];

  const remainingChapters = CHAPTERS.length - chapterIndex - 1;

  function chapterSummary(i: number): string {
    if (i === 0)
      return [labelsOf(RATING_CHOICES, rating ? [rating] : []), labelsOf(VISIT_CHOICES, visit ? [visit] : [])].flat().join("・");
    if (i === 1)
      return ateNothing
        ? "お食事なし"
        : [items.map((id) => findItem(id)?.label ?? ""), attrs.filter((a) => a !== "その他"), labelsOf(SERVICE_CHOICES, service)]
            .flat()
            .filter(Boolean)
            .join("・");
    if (i === 2)
      return (
        [labelsOf(ATMOSPHERE_CHOICES, atmosphere), labelsOf(GOOD_CHOICES, good), labelsOf(CONCERN_CHOICES, concern)].flat().join("・") ||
        "特になし"
      );
    return "";
  }

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      {/* ── 上部：店名と章の進捗 ── */}
      <div
        className="sticky top-0 z-20 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pb-[var(--product-space-12)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        <p className="text-center text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {STORE_NAME}
        </p>
        {phase === "chapters" ? (
          <div className="flex w-full flex-col gap-[var(--product-space-8)]">
            <div className="flex w-full gap-[var(--product-space-4)]">
              {CHAPTERS.map((c, i) => (
                <div
                  key={c.id}
                  className="h-1 min-w-px flex-1 rounded-[var(--product-radius-full)] transition-colors duration-300"
                  style={{
                    backgroundColor:
                      i < chapterIndex
                        ? "var(--review-accent-primary)"
                        : i === chapterIndex
                          ? "var(--review-accent-light)"
                          : "var(--product-color-border-default)",
                  }}
                />
              ))}
            </div>
            <div className="flex w-full items-baseline justify-between">
              <p className="text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {CHAPTERS[chapterIndex].title}
              </p>
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                {remainingChapters > 0 ? `あと${remainingChapters}章` : "最後の章です"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className={phase === "chapters" ? "flex w-full flex-1 flex-col pb-[132px]" : "flex w-full flex-1 flex-col"}>
        {phase === "chapters" ? (
          <div className="flex w-full flex-col gap-[var(--product-space-16)] px-[var(--product-space-20)]">
            {CHAPTERS.slice(0, chapterIndex).map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => reopenChapter(i)}
                className="flex w-full items-center justify-between gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid px-[var(--product-space-16)] py-[var(--product-space-12)] text-left"
                style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--product-color-border-default)" }}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[12px] font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
                    {c.title}
                  </span>
                  <span className="truncate text-[13px] font-medium" style={{ color: "var(--product-color-text-primary)" }}>
                    {chapterSummary(i)}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
                  直す
                </span>
              </button>
            ))}

            {followup ? (
              <FollowupCard followup={followup} onAnswer={answerFollowup} onSkip={skipFollowup} />
            ) : (
              <div key={CHAPTERS[chapterIndex].id} className="review-slide-in flex w-full flex-col gap-[var(--product-space-20)]">
                {chapterIndex === 0 ? (
                  <>
                    <FieldTitle title="本日の体験はいかがでしたか？" />
                    <CardList choices={RATING_CHOICES} selected={rating ? [rating] : []} onSelect={(id) => { tick(); setRating(id); }} />
                    {rating ? (
                      <RevealBlock>
                        <FieldTitle title="今日で何回目のご来店ですか？" />
                        <Segmented choices={VISIT_CHOICES} selected={visit} onSelect={(id) => { tick(); setVisit(id); }} />
                      </RevealBlock>
                    ) : null}
                  </>
                ) : null}

                {chapterIndex === 1 ? (
                  <>
                    <FieldTitle title="今日は何を召し上がりましたか？" note="いくつでも" />
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
                          // カテゴリを外したら、その中の品だけを外す（無関係の下流回答は消さない）
                          const allowed = new Set(MENU.filter((c) => next.includes(c.id)).flatMap((c) => c.items.map((i) => i.id)));
                          setItems((cur) => cur.filter((x) => allowed.has(x)));
                          return next;
                        });
                      }}
                    />
                    {!ateNothing &&
                      MENU.filter((c) => categories.includes(c.id)).map((c) => (
                        <RevealBlock key={c.id}>
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
                        </RevealBlock>
                      ))}
                    {items.length > 1 ? (
                      <RevealBlock>
                        <FieldTitle title="特に印象に残った1品は？" />
                        <ChipGrid
                          choices={items.map((id) => findItem(id)).filter((i): i is Choice => Boolean(i))}
                          selected={focusItem ? [focusItem] : []}
                          onToggle={(id) => { tick(); setFocusItem(id); }}
                        />
                      </RevealBlock>
                    ) : null}
                    {effectiveFocus ? (
                      <RevealBlock>
                        <FieldTitle title={`「${focusLabel}」はどうでした？`} note="いくつでも" />
                        {attrChoices ? (
                          <ChipGrid
                            choices={[...attrChoices, { id: "その他", label: "その他" }]}
                            selected={attrs}
                            onToggle={(id) => { tick(); setAttrs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }}
                          />
                        ) : (
                          <div className="flex h-11 items-center gap-[var(--product-space-8)]">
                            <AiSparkleIcon className="size-[15px] shrink-0" />
                            <span className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                              この品に合わせた選択肢を準備しています
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
                        )}
                        <FreeTextField value={attrNote} onChange={setAttrNote} />
                      </RevealBlock>
                    ) : null}
                    {ateNothing || attrsDone ? (
                      <RevealBlock>
                        <FieldTitle title="スタッフの様子はどうでした？" note="いくつでも" />
                        <ChipGrid
                          choices={SERVICE_CHOICES}
                          selected={service}
                          exclusiveId="none"
                          onToggle={(id) => {
                            tick();
                            setService((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                          }}
                        />
                      </RevealBlock>
                    ) : null}
                  </>
                ) : null}

                {chapterIndex === 2 ? (
                  <>
                    {/* 全員に同じ順番・同じ文言・同じ選択肢（評価による出し分けはしない） */}
                    <FieldTitle title="お店の中はどうでした？" note="いくつでも" />
                    <ChipGrid
                      choices={ATMOSPHERE_CHOICES}
                      selected={atmosphere}
                      exclusiveId="none"
                      onToggle={(id) => {
                        tick();
                        setAtmosphere((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                      }}
                    />
                    {atmosphere.length > 0 ? (
                      <RevealBlock>
                        <FieldTitle title="良かったところがあれば教えてください" note="無ければ「特になし」で" />
                        <ChipGrid
                          choices={GOOD_CHOICES}
                          selected={good}
                          exclusiveId="none"
                          onToggle={(id) => {
                            tick();
                            setGood((p) => (p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]));
                          }}
                        />
                      </RevealBlock>
                    ) : null}
                    {good.length > 0 ? (
                      <RevealBlock>
                        <FieldTitle title="気になったところがあれば教えてください" note="無ければ「特になし」で" />
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
                      </RevealBlock>
                    ) : null}
                  </>
                ) : null}

                {chapterIndex === 3 ? (
                  <>
                    <FieldTitle title="ほかに伝えたいことがあれば" note="なくても大丈夫です" />
                    <FreeTextField value={freeText} onChange={setFreeText} rows={3} placeholder="そのままの言葉でどうぞ（任意）" />
                  </>
                ) : null}

                <div className="flex w-full flex-col items-center gap-[var(--product-space-4)] pb-[var(--product-space-8)] pt-[var(--product-space-8)]">
                  <ReviewButton variant="primary" size="lg" disabled={!chapterComplete[chapterIndex]} onClick={() => void completeChapter()}>
                    {chapterIndex === CHAPTERS.length - 1 ? "下書きを見る" : "次へ"}
                  </ReviewButton>
                  {chapterIndex > 0 && chapterIndex < CHAPTERS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => { tick(); advance(); }}
                      className="flex h-11 items-center justify-center px-[var(--product-space-16)] text-[13px] font-medium"
                      style={{ color: "var(--product-color-text-muted)" }}
                    >
                      この章をスキップ
                    </button>
                  ) : null}
                </div>
              </div>
            )}
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
            onBack={() => { setPhase("chapters"); setChapterIndex(CHAPTERS.length - 1); }}
            canvas={<EditableCanvas value={draft} onChange={setEdited} streaming={generating} />}
          />
        ) : null}

        {phase === "destination" ? (
          <DestinationStep draft={draft} onChoose={(d) => { setDestination(d); setPhase("done"); }} />
        ) : null}

        {phase === "done" ? <DoneStep destination={destination} /> : null}
      </div>

      {phase === "chapters" ? (
        <div className="sticky bottom-0 z-10 mx-auto w-full max-w-[390px]">
          <DraftCanvas
            text={liveText}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            emptyHint="選ぶと、ここに感想が組み上がっていきます"
          />
        </div>
      ) : null}
    </div>
  );
}

/** 新しく現れた質問ブロック。見出しが見える位置まで穏やかにスクロールする */
function RevealBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }, []);
  return (
    <div ref={ref} className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
      {children}
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
            onClick={() => onToggle(choice.id)}
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
