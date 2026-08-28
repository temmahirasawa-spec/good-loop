"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCKS,
  STORE_NAME,
  TONES,
  collectPicked,
  composeSentences,
  isBlockComplete,
  visibleInBlock,
  type Answers,
  type Block,
  type Question,
  type Texts,
  type Tone,
} from "@/lib/demo/survey-data";
import { ReviewButton } from "@/components/rating-flow/Button";
import { CheckCircleOutlineIcon } from "@/components/rating-flow/icons";
import { DraftCanvas } from "./DraftCanvas";
import { BackIcon, CheckMarkIcon, MicIcon, StopIcon } from "./icons";

/**
 * アンケート v2 プロトタイプ（docs/specs/survey-v2.md 段1・**案C ＋ 案Aの手触り**）。
 *
 * **検証用。DBに書き込まず、AIも呼ばない**（下書きは候補からの抽選で「毎回少し違う」動きだけ再現）。
 *
 * 案C＝**選ぶたびに、画面下の器に自分の感想が組み上がっていくのが見える**。
 * 「選んでいるうちに自分の感想になっていく」を画面上の事実にする（2026-08-28 天真が採用）。
 *
 * 案A＝手触り。タップの沈み込み、選択肢の段階表示、質問のスライド、短い振動。
 * すべて `prefers-reduced-motion` で止まる。
 *
 * 初稿からの修正（2026-08-28 実機フィードバック）:
 *   ・複数選択がラジオボタンの丸だった → **四角＋チェックマーク**
 *   ・進捗が「あと約20秒」だった → **1 / 7**（秒数は馴染みがない）
 *   ・下書きが回答の直結だった → **言い回しを抽選**し、文体を選べるようにした
 */

type Phase = "questions" | "draft" | "destination" | "done";
type Destination = "google" | "store";



/** 端末を短く震わせる（対応していない端末では何も起きない） */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

export function DemoSurvey() {
  const [answers, setAnswers] = useState<Answers>({});
  const [texts, setTexts] = useState<Texts>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [expanded, setExpanded] = useState(false);
  const [tone, setTone] = useState<Tone>("normal");
  const [emoji, setEmoji] = useState(false);
  const [seed, setSeed] = useState(1);
  const [edited, setEdited] = useState<string | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** すでに文章にした質問。ここに無いものだけをAIに渡して「続き」を書かせる */
  const usedRef = useRef<Set<string>>(new Set());

  const aiDraftRef = useRef("");
  useEffect(() => {
    aiDraftRef.current = aiDraft;
  }, [aiDraft]);

  const block: Block | undefined = BLOCKS[index];
  const shownQuestions = block ? visibleInBlock(block, answers) : [];
  const canProceed = block ? isBlockComplete(block, answers) : false;
  const total = BLOCKS.length;

  // 質問中の器はこちら（即時・APIを呼ばない）。素材が集まっていく様子を見せる担当
  const composed = useMemo(
    () => composeSentences(answers, texts, { tone, emoji, seed }).join(""),
    [answers, texts, tone, emoji, seed]
  );
  // 質問中も下書き画面も、出しているのはAIが書いた文章。
  // 質問中は Haiku が「続きを書き足す」、最後に Sonnet が全体を整える（2026-08-28 天真の要望）
  const draft = edited ?? (aiDraft || (phase === "questions" ? "" : composed));

  /**
   * 質問が切り替わるたびに、**続きの1〜2文だけ**を書き足させる。
   *
   * 前の文章をそのまま残して後ろに足すので、器のタイピング演出が途切れない
   * （全体を書き直すと、毎回まるごと差し替わって「書き足されている」ように見えない）。
   */
  const appendLive = useCallback(
    async (nextAnswers: Answers, nextTexts: Texts, currentTone: Tone) => {
      const { picked, written } = collectPicked(nextAnswers, nextTexts);
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
            tone: currentTone,
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
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          // 失敗しても止めない。素材をそのまま足す
          setAiDraft(composeSentences(nextAnswers, nextTexts, { tone: currentTone, emoji: false, seed: 1 }).join(""));
        }
      } finally {
        setStreaming(false);
      }
    },
    []
  );

  /**
   * AIに書き直させる。**文字を受け取りながら器に流し込む**ので、
   * タイピングの演出が本物になる（偽のアニメーションで待たせない）。
   */
  const generate = useCallback(
    async (opts: { tone: Tone; emoji: boolean; seed: number }) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setEdited(null);
      setAiDraft("");
      setStreaming(true);
      try {
        const res = await fetch("/api/demo/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...collectPicked(answers, texts), ...opts }),
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
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          // 失敗しても画面は止めない。素材をそのまま出す
          setAiDraft(composeSentences(answers, texts, opts).join(""));
        }
      } finally {
        setStreaming(false);
      }
    },
    [answers, texts]
  );

  // 下書き画面に入ったら1回だけ書かせる
  useEffect(() => {
    if (phase !== "draft") return;
    void generate({ tone, emoji, seed });
    // 文体の切り替えは各ボタンから呼ぶ。ここで tone を依存に入れると二重に走る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * 画面を終える。**質問は次の画面へ進み、生成は後ろで進行する**
   * （2026-08-28 天真「その画面の最後の質問に答えると生成が開始」）。
   */
  function goNext(next: Answers) {
    if (block?.generates) void appendLive(next, texts, tone);
    if (index + 1 >= BLOCKS.length) {
      setPhase("draft");
      setExpanded(true);
      return;
    }
    setIndex(index + 1);
  }

  function selectSingle(q: Question, choiceId: string) {
    tick();
    setAnswers({ ...answers, [q.id]: [choiceId] });
  }

  function toggleMulti(q: Question, choiceId: string) {
    tick();
    const currentIds = answers[q.id] ?? [];
    const isNone = choiceId === "none";
    let nextIds: string[];
    if (currentIds.includes(choiceId)) {
      nextIds = currentIds.filter((id) => id !== choiceId);
    } else if (isNone) {
      nextIds = ["none"];
    } else {
      nextIds = [...currentIds.filter((id) => id !== "none"), choiceId];
    }
    setAnswers({ ...answers, [q.id]: nextIds });
  }

  function back() {
    if (phase === "draft") {
      setPhase("questions");
      setExpanded(false);
      setIndex(BLOCKS.length - 1);
      return;
    }
    if (index > 0) setIndex(index - 1);
  }

  const answeredCount = index + 1;

  // 器を画面下に固定するのは質問中だけ。下書き画面では読むものが主役なので上に置く
  const stickyCanvas = phase === "questions";

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <div className="flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pt-[var(--product-space-12)]">
        <div className="flex h-11 items-center justify-between">
          {(phase === "questions" && index > 0) || phase === "draft" ? (
            <button
              type="button"
              onClick={back}
              aria-label="前に戻る"
              className="flex size-11 items-center justify-center transition-transform active:scale-90"
              style={{ color: "var(--product-color-text-secondary)" }}
            >
              <BackIcon className="size-5" />
            </button>
          ) : (
            <span className="size-11" />
          )}
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {STORE_NAME}
          </p>
          <span className="size-11" />
        </div>
        {phase === "questions" ? (
          <div className="flex w-full items-center gap-[var(--product-space-12)]">
            <div
              className="h-1 flex-1 overflow-hidden rounded-[var(--product-radius-full)]"
              style={{ backgroundColor: "var(--product-color-border-default)" }}
            >
              <div
                className="h-full rounded-[var(--product-radius-full)] transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.round((answeredCount / total) * 100)}%`,
                  backgroundColor: "var(--review-accent-primary)",
                }}
              />
            </div>
            <p
              className="shrink-0 text-xs font-bold tabular-nums"
              style={{ color: "var(--product-color-text-secondary)" }}
            >
              {answeredCount} / {total}
            </p>
          </div>
        ) : null}
      </div>

      {/* 器のぶんの余白を本文側で確保する（固定要素に中身を隠させない） */}
      <div className={stickyCanvas ? "flex w-full flex-1 flex-col pb-[168px]" : "flex w-full flex-1 flex-col"}>
        {phase === "questions" && block ? (
          <BlockStep
            key={block.id}
            block={block}
            questions={shownQuestions}
            answers={answers}
            texts={texts}
            canProceed={canProceed}
            onSelectSingle={selectSingle}
            onToggleMulti={toggleMulti}
            onChangeText={(qid, v) => setTexts({ ...texts, [qid]: v })}
            onConfirm={() => goNext(answers)}
            onSkip={() => {
              const cleared = { ...answers };
              block.questions.forEach((question) => {
                if ((cleared[question.id] ?? []).length === 0) cleared[question.id] = [];
              });
              setAnswers(cleared);
              goNext(cleared);
            }}
          />
        ) : null}

        {phase === "draft" ? (
          <DraftTools
            tone={tone}
            emoji={emoji}
            onTone={(t) => {
              tick();
              setTone(t);
              void generate({ tone: t, emoji, seed });
            }}
            onEmoji={() => {
              tick();
              const next = !emoji;
              setEmoji(next);
              void generate({ tone, emoji: next, seed });
            }}
            onRegenerate={() => {
              tick();
              const next = seed + 1;
              setSeed(next);
              void generate({ tone, emoji, seed: next });
            }}
            onNext={() => setPhase("destination")}
            canvas={<EditableCanvas value={draft} onChange={setEdited} streaming={streaming} />}
          />
        ) : null}

        {phase === "destination" ? (
          <DestinationStep
            draft={draft}
            onChoose={(d) => {
              setDestination(d);
              setPhase("done");
            }}
          />
        ) : null}

        {phase === "done" ? <DoneStep destination={destination} /> : null}
      </div>

      {stickyCanvas ? (
        <div className="sticky bottom-0 z-10 mx-auto w-full max-w-[390px]">
          <DraftCanvas
            text={draft}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            emptyHint="ここに、あなたの感想が組み上がっていきます"
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * 1画面ぶんの質問（2026-08-28「1画面1生成」）。
 *
 * **前の質問に答えると、次の質問がふわっと現れる。** 一度に全部見せない。
 * 最後の質問まで答えると「次へ」が押せるようになり、押した時点で
 * この画面ぶんの文章が書き足される。
 */
function BlockStep({
  block,
  questions,
  answers,
  texts,
  canProceed,
  onSelectSingle,
  onToggleMulti,
  onChangeText,
  onConfirm,
  onSkip,
}: {
  block: Block;
  questions: Question[];
  answers: Answers;
  texts: Texts;
  canProceed: boolean;
  onSelectSingle: (q: Question, choiceId: string) => void;
  onToggleMulti: (q: Question, choiceId: string) => void;
  onChangeText: (questionId: string, value: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pt-[var(--product-space-20)]">
      <div className="flex w-full flex-col gap-[var(--product-space-4)]">
        <h1
          className="text-xl font-bold leading-[1.5] tracking-[0.2px]"
          style={{ color: "var(--product-color-text-primary)" }}
        >
          {block.title}
        </h1>
        {block.note ? (
          <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {block.note}
          </p>
        ) : null}
      </div>

      {questions.map((question, qi) => (
        <QuestionField
          key={question.id}
          question={question}
          first={qi === 0}
          selected={answers[question.id] ?? []}
          text={texts[question.id] ?? ""}
          onSelectSingle={(cid) => onSelectSingle(question, cid)}
          onToggleMulti={(cid) => onToggleMulti(question, cid)}
          onChangeText={(v) => onChangeText(question.id, v)}
        />
      ))}

      <div className="flex w-full flex-col items-center gap-[var(--product-space-4)] pb-[var(--product-space-8)] pt-[var(--product-space-8)]">
        <ReviewButton variant="primary" size="lg" disabled={!canProceed} onClick={onConfirm}>
          次へ
        </ReviewButton>
        <button
          type="button"
          onClick={onSkip}
          className="flex h-11 items-center justify-center px-[var(--product-space-16)] text-[13px] font-medium"
          style={{ color: "var(--product-color-text-muted)" }}
        >
          スキップ
        </button>
      </div>
    </div>
  );
}

/** 質問ひとつぶん（見出し＋選択肢＋任意のテキスト欄） */
function QuestionField({
  question,
  first,
  selected,
  text,
  onSelectSingle,
  onToggleMulti,
  onChangeText,
}: {
  question: Question;
  first: boolean;
  selected: string[];
  text: string;
  onSelectSingle: (choiceId: string) => void;
  onToggleMulti: (choiceId: string) => void;
  onChangeText: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  return (
    <div className={`flex w-full flex-col gap-[var(--product-space-12)] ${first ? "" : "review-rise"}`}>
      <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        {question.title}
        {question.note ? (
          <span className="pl-[var(--product-space-8)] text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {question.note}
          </span>
        ) : null}
      </p>

      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        {question.choices.map((choice, i) => {
          const isSelected = selected.includes(choice.id);
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => (question.kind === "single" ? onSelectSingle(choice.id) : onToggleMulti(choice.id))}
              className="review-rise flex w-full items-center gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-solid px-[var(--product-space-16)] py-[var(--product-space-12)] text-left transition-transform duration-100 active:scale-[0.975]"
              style={{
                animationDelay: `${i * 35}ms`,
                minHeight: "var(--product-touch-min)",
                backgroundColor: isSelected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                borderWidth: isSelected ? 2 : 1.5,
                borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
              }}
            >
              {question.kind === "multi" ? (
                <span
                  aria-hidden
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-[var(--product-radius-sm)] border-solid transition-colors"
                  style={{
                    borderWidth: 1.5,
                    borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
                    backgroundColor: isSelected ? "var(--review-accent-primary)" : "transparent",
                  }}
                >
                  {isSelected ? (
                    <CheckMarkIcon className="review-pop size-4" style={{ color: "var(--review-accent-on-primary)" }} />
                  ) : null}
                </span>
              ) : null}
              <span
                className="text-base font-bold"
                style={{ color: isSelected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}
              >
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>

      {question.freeText ? (
        <div className="relative w-full">
          <textarea
            id={`text-${question.id}`}
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            rows={2}
            placeholder="ほかにあれば、そのままの言葉で（任意）"
            className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] pr-[56px] text-[15px]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--product-color-border-default)",
              color: "var(--product-color-text-primary)",
            }}
          />
          <button
            type="button"
            onClick={() => {
              tick();
              setRecording(!recording);
            }}
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
      ) : null}
    </div>
  );
}

/** 下書き画面の道具立て。器はそのまま下に残り、ここでは文体と再生成だけを扱う */
function DraftTools({
  tone,
  emoji,
  onTone,
  onEmoji,
  onRegenerate,
  onNext,
  canvas,
}: {
  tone: Tone;
  emoji: boolean;
  onTone: (t: Tone) => void;
  onEmoji: () => void;
  onRegenerate: () => void;
  onNext: () => void;
  canvas: React.ReactNode;
}) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pt-[var(--product-space-24)]">
      <div className="flex w-full flex-col gap-[var(--product-space-4)]">
        <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          下書きができました
        </h1>
        <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          あなたが選んだ内容だけで作りました。そのまま使っても、書き直しても大丈夫です
        </p>
      </div>

      {canvas}

      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <p className="text-[13px] font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
          言い方を変える
        </p>
        <div className="flex w-full gap-[var(--product-space-8)]">
          {TONES.map((t) => {
            const active = t.id === tone;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => onTone(t.id)}
                className="flex h-11 flex-1 items-center justify-center rounded-[var(--product-radius-full)] border-solid transition-transform active:scale-95"
                style={{
                  borderWidth: active ? 2 : 1.5,
                  borderColor: active ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
                  backgroundColor: active ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                  color: active ? "var(--review-accent-primary)" : "var(--product-color-text-primary)",
                }}
              >
                <span className="text-sm font-bold">{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex w-full gap-[var(--product-space-8)]">
          <button
            type="button"
            aria-pressed={emoji}
            onClick={onEmoji}
            className="flex h-11 flex-1 items-center justify-center rounded-[var(--product-radius-full)] border-solid transition-transform active:scale-95"
            style={{
              borderWidth: emoji ? 2 : 1.5,
              borderColor: emoji ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
              backgroundColor: emoji ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
              color: emoji ? "var(--review-accent-primary)" : "var(--product-color-text-primary)",
            }}
          >
            <span className="text-sm font-bold">絵文字を入れる</span>
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="flex h-11 flex-1 items-center justify-center rounded-[var(--product-radius-full)] border-[1.5px] border-solid transition-transform active:scale-95"
            style={{
              borderColor: "var(--product-color-border-default)",
              backgroundColor: "var(--product-color-surface-white)",
              color: "var(--product-color-text-primary)",
            }}
          >
            <span className="text-sm font-bold">別の言い方にする</span>
          </button>
        </div>
      </div>

      <div className="mt-auto flex w-full flex-col items-center pb-[var(--product-space-8)] pt-[var(--product-space-16)]">
        <ReviewButton variant="primary" size="lg" onClick={onNext}>
          この内容で進む
        </ReviewButton>
      </div>
    </div>
  );
}

/** 下書き画面での器。ここでは本人が直接編集できる */
function EditableCanvas({
  value,
  onChange,
  streaming,
}: {
  value: string;
  onChange: (v: string) => void;
  streaming: boolean;
}) {
  return (
    <div
      className="w-full rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--review-accent-primary)",
      }}
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
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        readOnly={streaming}
        className="w-full resize-none border-none bg-transparent p-0 text-[15px] leading-[1.9] outline-none"
        style={{ color: "var(--product-color-text-primary)" }}
      />
    </div>
  );
}

/**
 * 宛先を選ぶ（案I）。**全員に完全同一の1枚**（2026-08-28 天真の決定）。
 * 2つのカードは重さを揃え、**どちらが良いかを書かない。事実だけ書く**
 * （docs/review-flow-rationale.md 3章の恒久ルール）。
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
      <p
        className="text-center text-sm font-medium leading-[1.8]"
        style={{ color: "var(--product-color-text-secondary)" }}
      >
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
