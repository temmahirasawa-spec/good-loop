"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ATMOSPHERE_CHOICES,
  ATTR_CHOICES,
  CHAPTERS,
  CONCERN_CHOICES,
  EAT_NOTHING_ID,
  MENU,
  POSITIVE_CHOICES,
  RATING_CHOICES,
  SERVICE_CHOICES,
  STORE_NAME,
  TONES,
  VISIT_CHOICES,
  findItem,
  labelsOf,
  type Choice,
  type Tone,
} from "@/lib/demo/survey-data";
import type { FollowupReason } from "@/lib/demo/draft-prompt-types";
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

type Followup = { reason: FollowupReason; question: string; choices: string[] };

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
  const [concern, setConcern] = useState<string[]>([]);
  const [positive, setPositive] = useState<string[]>([]);
  const [concernNote, setConcernNote] = useState("");
  const [freeText, setFreeText] = useState("");
  const [followupQA, setFollowupQA] = useState<{ question: string; answer: string }[]>([]);

  /* ── 進行 ─────────────────────────────── */
  const [chapterIndex, setChapterIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("chapters");
  const [expanded, setExpanded] = useState(false);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [followupCount, setFollowupCount] = useState(0);
  const [destination, setDestination] = useState<Destination | null>(null);

  /* ── 生成 ─────────────────────────────── */
  const [tone, setTone] = useState<Tone>("normal");
  const [emoji, setEmoji] = useState(false);
  const [seed, setSeed] = useState(1);
  const [aiDraft, setAiDraft] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const usedRef = useRef<Set<string>>(new Set());
  const aiDraftRef = useRef("");
  useEffect(() => {
    aiDraftRef.current = aiDraft;
  }, [aiDraft]);

  const ratingNum = Number(rating ?? 0);
  const ateNothing = categories.includes(EAT_NOTHING_ID);
  const effectiveFocus = items.length === 1 ? items[0] : focusItem;
  const focusLabel = effectiveFocus ? findItem(effectiveFocus)?.label ?? "" : "";

  /** いまの全材料。appendLive が usedRef で「まだ送っていないものだけ」を送る */
  const collectMaterials = useCallback(() => {
    const picked: { question: string; values: string[] }[] = [];
    if (visit) picked.push({ question: "来店回数", values: labelsOf(VISIT_CHOICES, [visit]) });
    if (items.length > 0)
      picked.push({ question: "召し上がったもの", values: items.map((id) => findItem(id)?.label ?? "").filter(Boolean) });
    if (effectiveFocus && attrs.length > 0)
      picked.push({ question: `「${focusLabel}」の感想`, values: labelsOf(ATTR_CHOICES, attrs) });
    if (service.length > 0) picked.push({ question: "接客", values: labelsOf(SERVICE_CHOICES, service) });
    if (atmosphere.length > 0) picked.push({ question: "お店の様子", values: labelsOf(ATMOSPHERE_CHOICES, atmosphere) });
    if (concern.length > 0) picked.push({ question: "気になったこと", values: labelsOf(CONCERN_CHOICES, concern) });
    if (positive.length > 0) picked.push({ question: "良かったところ", values: labelsOf(POSITIVE_CHOICES, positive) });
    for (const qa of followupQA) picked.push({ question: `質問「${qa.question}」への答え`, values: [qa.answer] });
    const written = [attrNote, concernNote, freeText].map((t) => t.trim()).filter((t) => t !== "");
    return { picked, written };
  }, [visit, items, effectiveFocus, focusLabel, attrs, service, atmosphere, concern, positive, followupQA, attrNote, concernNote, freeText]);

  /** 章を終えるたびに、続きの1〜2文だけを書き足させる（Haiku・ストリーミング） */
  const appendLive = useCallback(async () => {
    const { picked, written } = collectMaterials();
    const fresh = picked.filter((g) => !usedRef.current.has(g.question));
    const freshText = written.filter((w) => !usedRef.current.has(`text:${w}`));
    if (fresh.length === 0 && freshText.length === 0) return;
    fresh.forEach((g) => usedRef.current.add(g.question));
    freshText.forEach((w) => usedRef.current.add(`text:${w}`));

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    const base = aiDraftRef.current;
    try {
      const res = await fetch("/api/demo/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live",
          written_so_far: base,
          picked: fresh,
          written: freshText,
          rating: null,
          tone,
          emoji: false,
        }),
        signal: ac.signal,
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAiDraft(base + acc.trimStart());
      }
    } catch {
      // 失敗しても回答は失われない。最後の仕上げ（final）が全材料から書き直す
    } finally {
      setStreaming(false);
    }
  }, [collectMaterials, tone]);

  /** 最後の仕上げ（Sonnet・全体を書き直す）。空欄から始める */
  const generateFinal = useCallback(
    async (opts: { tone: Tone; emoji: boolean; seed: number }) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setEdited(null);
      setAiDraft("");
      setStreaming(true);
      try {
        const { picked, written } = collectMaterials();
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "final", picked, written, rating: null, ...opts }),
          signal: ac.signal,
        });
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no stream");
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          setAiDraft((prev) => prev + decoder.decode(value, { stream: true }));
        }
      } catch {
        /* 画面は止めない */
      } finally {
        setStreaming(false);
      }
    },
    [collectMaterials]
  );

  useEffect(() => {
    if (phase !== "draft") return;
    void generateFinal({ tone, emoji, seed });
    // 文体切替は各ボタンから。ここで tone を依存に入れると二重に走る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ── 章の完了判定 ───────────────────────── */
  const attrsDone = attrs.length > 0 || attrNote.trim() !== "";
  const chapterComplete: boolean[] = [
    rating !== null && visit !== null,
    ateNothing || (items.length > 0 && (items.length === 1 || focusItem !== null) && attrsDone && service.length > 0),
    atmosphere.length > 0 && (ratingNum >= 4 ? concern.length > 0 : positive.length > 0),
    true, // 伝えたいことは任意
  ];

  /** AI追質問の引き金（情報が足りないときだけ。最大2問） */
  function detectFollowupReason(): FollowupReason | null {
    if (followupCount >= 2) return null;
    const asked = new Set(followupQA.map((qa) => qa.question));
    if (effectiveFocus && (attrs.includes("other") || (attrs.length === 0 && attrNote.trim() === "")) && !asked.has("item"))
      return "vague-item";
    if (ratingNum >= 4 && concern.includes("wait")) return "wait-detail";
    if (ratingNum > 0 && ratingNum <= 3 && labelsOf(POSITIVE_CHOICES, positive).length === 0 && concernNote.trim() === "")
      return "low-rating-unclear";
    return null;
  }

  const askedReasonsRef = useRef<Set<string>>(new Set());

  async function maybeAskFollowup(): Promise<boolean> {
    const reason = detectFollowupReason();
    if (!reason || askedReasonsRef.current.has(reason)) return false;
    askedReasonsRef.current.add(reason);
    setFollowupCount((c) => c + 1);
    const { picked } = collectMaterials();
    try {
      const res = await fetch("/api/demo/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "followup", reason, picked, written: [], rating: null, tone, emoji: false }),
      });
      const data = (await res.json()) as { question: string; choices: string[] };
      setFollowup({ reason, ...data });
    } catch {
      setFollowup(null);
      return false;
    }
    return true;
  }

  /** 章を終える。生成は後ろで進み、次の章が下に現れる */
  async function completeChapter() {
    tick();
    void appendLive();
    if (chapterIndex === 2) {
      // 印象に残ったことの後だけ、足りなければAIが1問だけ聞く
      const asked = await maybeAskFollowup();
      if (asked) return; // 追質問に答えてから次へ
    }
    if (chapterIndex + 1 >= CHAPTERS.length) {
      setPhase("draft");
      return;
    }
    setChapterIndex(chapterIndex + 1);
  }

  function answerFollowup(answer: string) {
    tick();
    if (!followup) return;
    setFollowupQA([...followupQA, { question: followup.question, answer }]);
    setFollowup(null);
    // 答えも器に流し込む（次のレンダー後に材料が揃う）
    setTimeout(() => void appendLive(), 0);
    setChapterIndex(3);
  }

  function skipFollowup() {
    setFollowup(null);
    setChapterIndex(3);
  }

  /** 終えた章を直す。下書きは白紙に戻し、次の「次へ」で全部を書き直す */
  function reopenChapter(i: number) {
    tick();
    abortRef.current?.abort();
    usedRef.current.clear();
    askedReasonsRef.current.clear();
    setAiDraft("");
    setEdited(null);
    setFollowup(null);
    setFollowupQA([]);
    setFollowupCount(0);
    setChapterIndex(i);
  }

  /* ── 表示 ─────────────────────────────── */
  const remainingChapters = CHAPTERS.length - chapterIndex - 1;
  const remainingSeconds = CHAPTERS.slice(chapterIndex + 1).reduce((a, c) => a + c.seconds, 0);
  const draft = edited ?? aiDraft;

  /** 終えた章の要約テキスト */
  function chapterSummary(i: number): string {
    if (i === 0)
      return [labelsOf(RATING_CHOICES, rating ? [rating] : []), labelsOf(VISIT_CHOICES, visit ? [visit] : [])]
        .flat()
        .join("・");
    if (i === 1)
      return ateNothing
        ? "お食事なし"
        : [items.map((id) => findItem(id)?.label ?? ""), labelsOf(ATTR_CHOICES, attrs), labelsOf(SERVICE_CHOICES, service)]
            .flat()
            .filter(Boolean)
            .join("・");
    if (i === 2)
      return [
        labelsOf(ATMOSPHERE_CHOICES, atmosphere),
        labelsOf(CONCERN_CHOICES, concern),
        labelsOf(POSITIVE_CHOICES, positive),
      ]
        .flat()
        .join("・") || "特になし";
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
                {remainingChapters > 0 ? `あと${remainingChapters}章・約${remainingSeconds}秒` : "最後の章です"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className={phase === "chapters" ? "flex w-full flex-1 flex-col pb-[168px]" : "flex w-full flex-1 flex-col"}>
        {phase === "chapters" ? (
          <div className="flex w-full flex-col gap-[var(--product-space-16)] px-[var(--product-space-20)]">
            {/* 終えた章の要約（戻る導線。自動前進で答えを直せなくしない） */}
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

            {/* AI追質問（あれば、いまの章の下に出る） */}
            {followup ? (
              <FollowupCard followup={followup} onAnswer={answerFollowup} onSkip={skipFollowup} />
            ) : (
              <div key={CHAPTERS[chapterIndex].id} className="review-slide-in flex w-full flex-col gap-[var(--product-space-20)]">
                {chapterIndex === 0 ? (
                  <>
                    <FieldTitle title="本日の体験はいかがでしたか？" />
                    <CardList choices={RATING_CHOICES} selected={rating ? [rating] : []} onSelect={(id) => { tick(); setRating(id); }} />
                    {rating ? (
                      <div className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
                        <FieldTitle title="今日で何回目のご来店ですか？" />
                        <Segmented choices={VISIT_CHOICES} selected={visit} onSelect={(id) => { tick(); setVisit(id); }} />
                      </div>
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
                          // カテゴリを外したら、その中の品も外す（矛盾回答を残さない）
                          const allowed = new Set(MENU.filter((c) => next.includes(c.id)).flatMap((c) => c.items.map((i) => i.id)));
                          setItems((cur) => cur.filter((x) => allowed.has(x)));
                          return next;
                        });
                      }}
                    />
                    {!ateNothing &&
                      MENU.filter((c) => categories.includes(c.id)).map((c) => (
                        <div key={c.id} className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
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
                    {items.length > 1 ? (
                      <div className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
                        <FieldTitle title="特に印象に残った1品は？" />
                        <ChipGrid
                          choices={items.map((id) => findItem(id)).filter((i): i is Choice => Boolean(i))}
                          selected={focusItem ? [focusItem] : []}
                          onToggle={(id) => { tick(); setFocusItem(id); setAttrs([]); }}
                        />
                      </div>
                    ) : null}
                    {effectiveFocus ? (
                      <div className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
                        <FieldTitle title={`「${focusLabel}」はどうでした？`} note="いくつでも" />
                        <ChipGrid
                          choices={ATTR_CHOICES}
                          selected={attrs}
                          onToggle={(id) => { tick(); setAttrs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); }}
                        />
                        <FreeTextField value={attrNote} onChange={setAttrNote} />
                      </div>
                    ) : null}
                    {ateNothing || attrsDone ? (
                      <div className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
                        <FieldTitle title="スタッフの様子はどうでした？" note="いくつでも" />
                        <ChipGrid
                          choices={SERVICE_CHOICES}
                          selected={service}
                          exclusiveId="none"
                          onToggle={(id) => {
                            tick();
                            setService((p) =>
                              p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]
                            );
                          }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                {chapterIndex === 2 ? (
                  <>
                    <FieldTitle title="お店の中はどうでした？" note="いくつでも" />
                    <ChipGrid
                      choices={ATMOSPHERE_CHOICES}
                      selected={atmosphere}
                      exclusiveId="none"
                      onToggle={(id) => {
                        tick();
                        setAtmosphere((p) =>
                          p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]
                        );
                      }}
                    />
                    {atmosphere.length > 0 ? (
                      <div className="review-rise flex w-full flex-col gap-[var(--product-space-12)]">
                        <FieldTitle
                          title={ratingNum >= 4 ? "少し気になったことはありますか？" : "良かったところもあれば教えてください"}
                          note="無ければ「特になし」で"
                        />
                        <ChipGrid
                          choices={ratingNum >= 4 ? CONCERN_CHOICES : POSITIVE_CHOICES}
                          selected={ratingNum >= 4 ? concern : positive}
                          exclusiveId="none"
                          onToggle={(id) => {
                            tick();
                            const setter = ratingNum >= 4 ? setConcern : setPositive;
                            setter((p) =>
                              p.includes(id) ? p.filter((x) => x !== id) : id === "none" ? ["none"] : [...p.filter((x) => x !== "none"), id]
                            );
                          }}
                        />
                        <FreeTextField value={concernNote} onChange={setConcernNote} />
                      </div>
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
                  <ReviewButton
                    variant="primary"
                    size="lg"
                    disabled={!chapterComplete[chapterIndex]}
                    onClick={() => void completeChapter()}
                  >
                    {chapterIndex === CHAPTERS.length - 1 ? "下書きを見る" : "次へ"}
                  </ReviewButton>
                  {chapterIndex > 0 && chapterIndex < CHAPTERS.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => void completeChapter()}
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
            onTone={(t) => { tick(); setTone(t); void generateFinal({ tone: t, emoji, seed }); }}
            onEmoji={() => { tick(); const next = !emoji; setEmoji(next); void generateFinal({ tone, emoji: next, seed }); }}
            onRegenerate={() => { tick(); const next = seed + 1; setSeed(next); void generateFinal({ tone, emoji, seed: next }); }}
            onNext={() => setPhase("destination")}
            onBack={() => { setPhase("chapters"); setChapterIndex(CHAPTERS.length - 1); }}
            canvas={<EditableCanvas value={draft} onChange={setEdited} streaming={streaming} />}
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
            text={draft}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            emptyHint="選ぶと、ここに感想が組み上がっていきます"
          />
        </div>
      ) : null}
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
  onTone,
  onEmoji,
  onRegenerate,
  onNext,
  onBack,
  canvas,
}: {
  tone: Tone;
  emoji: boolean;
  onTone: (t: Tone) => void;
  onEmoji: () => void;
  onRegenerate: () => void;
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

      <div className="flex w-full items-center gap-[var(--product-space-8)]">
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
        onClick={onRegenerate}
        className="flex h-11 w-full items-center justify-center gap-[var(--product-space-8)] rounded-[var(--product-radius-sm)] border-[1.5px] border-solid"
        style={{
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
    { id: "store", title: "お店にだけ届ける", note: "代表が直接読みます" },
  ];
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        この感想を、どうしますか？
      </h1>
      <p
        className="line-clamp-3 rounded-[var(--product-radius-md)] p-[var(--product-space-12)] text-[13px] leading-[1.8]"
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
