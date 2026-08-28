"use client";

import { useMemo, useState } from "react";
import {
  STORE_NAME,
  TONES,
  composeSentences,
  visibleQuestions,
  type Answers,
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

const AUTO_ADVANCE_MS = 220;

/**
 * 進捗の分母（2026-08-28）。
 *
 * 分岐で質問が増える設計のため、実際の問数をそのまま出すと**分母が増えていく**。
 * 「1/3」で始まって「5/7」になるのは、終わりが見えず体験として最悪。
 * そこで**見込みの問数で固定**し、最後の質問に着いたときだけ実数に補正する。
 * 途中で増えることはなく、終わりは必ず「7 / 7」で揃う（早く終わるぶんには気持ちがよい）。
 */
const PLANNED_QUESTIONS = 7;

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

  const questions = visibleQuestions(answers);
  const current: Question | undefined = questions[index];
  const isLastQuestion = index + 1 >= questions.length;
  const total = isLastQuestion ? index + 1 : Math.max(PLANNED_QUESTIONS, questions.length);

  const composed = useMemo(
    () => composeSentences(answers, texts, { tone, emoji, seed }).join(""),
    [answers, texts, tone, emoji, seed]
  );
  const draft = edited ?? composed;

  function goNext(next: Answers) {
    const list = visibleQuestions(next);
    if (index + 1 >= list.length) {
      setPhase("draft");
      setExpanded(true);
      return;
    }
    setIndex(index + 1);
  }

  function selectSingle(q: Question, choiceId: string) {
    tick();
    const next = { ...answers, [q.id]: [choiceId] };
    setAnswers(next);
    window.setTimeout(() => goNext(next), AUTO_ADVANCE_MS);
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
      setIndex(Math.max(questions.length - 1, 0));
      return;
    }
    if (index > 0) setIndex(index - 1);
  }

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
                  width: `${Math.round(((index + 1) / total) * 100)}%`,
                  backgroundColor: "var(--review-accent-primary)",
                }}
              />
            </div>
            <p
              className="shrink-0 text-xs font-bold tabular-nums"
              style={{ color: "var(--product-color-text-secondary)" }}
            >
              {index + 1} / {total}
            </p>
          </div>
        ) : null}
      </div>

      {/* 器のぶんの余白を本文側で確保する（固定要素に中身を隠させない） */}
      <div className={stickyCanvas ? "flex w-full flex-1 flex-col pb-[148px]" : "flex w-full flex-1 flex-col"}>
        {phase === "questions" && current ? (
          <QuestionStep
            key={current.id}
            question={current}
            selected={answers[current.id] ?? []}
            text={texts[current.id] ?? ""}
            onSelectSingle={(cid) => selectSingle(current, cid)}
            onToggleMulti={(cid) => toggleMulti(current, cid)}
            onChangeText={(v) => setTexts({ ...texts, [current.id]: v })}
            onConfirm={() => goNext(answers)}
            onSkip={() => {
              const next = { ...answers, [current.id]: [] };
              setAnswers(next);
              goNext(next);
            }}
          />
        ) : null}

        {phase === "draft" ? (
          <DraftTools
            tone={tone}
            emoji={emoji}
            onTone={(t) => {
              tick();
              setEdited(null);
              setTone(t);
            }}
            onEmoji={() => {
              tick();
              setEdited(null);
              setEmoji(!emoji);
            }}
            onRegenerate={() => {
              tick();
              setEdited(null);
              setSeed(seed + 1);
            }}
            onNext={() => setPhase("destination")}
            canvas={<EditableCanvas value={draft} onChange={setEdited} />}
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

function QuestionStep({
  question,
  selected,
  text,
  onSelectSingle,
  onToggleMulti,
  onChangeText,
  onConfirm,
  onSkip,
}: {
  question: Question;
  selected: string[];
  text: string;
  onSelectSingle: (choiceId: string) => void;
  onToggleMulti: (choiceId: string) => void;
  onChangeText: (value: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const [recording, setRecording] = useState(false);

  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-16)] px-[var(--product-space-20)] pt-[var(--product-space-20)]">
      <div className="flex w-full flex-col gap-[var(--product-space-4)]">
        <h1
          className="text-xl font-bold leading-[1.5] tracking-[0.2px]"
          style={{ color: "var(--product-color-text-primary)" }}
        >
          {question.title}
        </h1>
        {question.note ? (
          <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {question.note}
          </p>
        ) : null}
      </div>

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
                animationDelay: `${i * 40}ms`,
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
        <div className="flex w-full flex-col gap-[var(--product-space-8)]">
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
        </div>
      ) : null}

      <div className="flex w-full flex-col items-center gap-[var(--product-space-4)] pb-[var(--product-space-8)]">
        {question.kind === "multi" ? (
          <ReviewButton variant="primary" size="lg" disabled={selected.length === 0} onClick={onConfirm}>
            次へ
          </ReviewButton>
        ) : null}
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
function EditableCanvas({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      className="w-full rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--review-accent-primary)",
      }}
    >
      <p className="pb-[var(--product-space-8)] text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
        あなたの感想（タップして直せます）
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
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
