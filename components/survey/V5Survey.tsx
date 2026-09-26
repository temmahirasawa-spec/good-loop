"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleOutlineIcon } from "@/components/rating-flow/icons";
import { BackIcon, CheckMarkIcon, MicIcon } from "@/components/demo/icons";
import { AskChip } from "@/components/survey/AskChip";
import { SuggestLine } from "@/components/survey/SuggestLine";
import { useAskQuestion } from "@/components/survey/useAskQuestion";
import { RATING_CHOICES, STORE_NAME } from "@/lib/demo/survey-data";
import { TOPIC_TAGS, questionFor, topicTag } from "@/lib/survey/topic-questions";

/**
 * アンケート v5 のプロトタイプ（docs/specs/survey-v5.md）。
 *
 * **検証専用。DBには一切書き込まない。** 本番のお客様導線（/r/[storeSlug]）には影響しない。
 * v4（/demo/v4）はそのまま残してあるので、並べて比べられる。
 *
 * v4 からの変更（2026-09-26 天真の決定）:
 *   ・★と口コミ作成を分ける。本文欄は届け先を選んだあとの「書く画面」だけに置く
 *   ・届け先の2枚の扉は同じ形・同じ強さ。どちらの扉にも「書かずに届ける（主）」と「文章も書く」がある。
 *     ★だけの強調は Google の扉の中で行う（LP「2つの扉は同じ重さ」を守る）
 *   ・書く画面のAIは3つ：続きを聞く（問いを1つ返す）／整える（v4）／キーボードのマイクの案内
 *   ・AIの問いの頭に小さく「AI」と付ける
 *   ・続きの文をAIが出す形（予測変換）は入れない
 */

type Phase = "rating" | "topics" | "destination" | "starOnly" | "write" | "storeConfirm" | "done";
type Destination = "google" | "store";

/** 短い触覚。対応していない端末では何も起きない */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

/** 「整える」が出る条件（v4 §6-2 と同じ） */
const POLISH_MIN_CHARS = 6;
const POLISH_IDLE_MS = 800;
const POLISH_MAX_USES = 3;

const DESTINATION_LABEL: Record<Destination, { title: string; note: string }> = {
  google: { title: "Googleマップ", note: "だれでも読めます" },
  store: { title: "お店だけ", note: "お店の人だけが読みます" },
};

export function V5Survey() {
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>("google");
  const [body, setBody] = useState("");
  const [composing, setComposing] = useState(false);

  /** 問いのローテーション。同じ店で同じ問いが並ばないようにする */
  const [rotation, setRotation] = useState(0);

  // ── 整える（v4 と同じ。検査は /api/survey/polish のサーバー側） ──
  const [beforeAdopt, setBeforeAdopt] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [polishUses, setPolishUses] = useState(0);
  /** 採用は1回まで（v4 のレビューで決めた。2回目の検査の基準がAIの出力になるため） */
  const [adopted, setAdopted] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [idle, setIdle] = useState(false);
  const [copied, setCopied] = useState(false);

  const idleTimer = useRef<number | null>(null);
  const polishAbort = useRef<AbortController | null>(null);
  const finishTimer = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── 続きを聞く（A1・A2）。整えるの候補が出ている間は問いを引っ込める ──
  const { question, exitHint } = useAskQuestion({
    body,
    composing,
    active: phase === "write",
    paused: suggestion !== null || polishing,
  });

  // hydration のずれを避けるため、乱数はマウント後に決める
  useEffect(() => {
    setRotation(Math.floor(Math.random() * 3));
  }, []);

  /** 入力が止まったら idle にする（「整える」の出現条件のひとつ） */
  useEffect(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), POLISH_IDLE_MS);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [body]);

  const ratingLabel = RATING_CHOICES.find((c) => c.id === rating)?.label ?? "";
  const placeholder = questionFor(topics, rotation);
  const sentenceCount = useMemo(() => (body.match(/。/g) ?? []).length, [body]);

  const canPolish =
    Array.from(body.trim()).length >= POLISH_MIN_CHARS &&
    idle &&
    !composing &&
    sentenceCount < 2 &&
    polishUses < POLISH_MAX_USES &&
    !adopted &&
    !polishing;

  const chooseRating = (id: string) => {
    tick();
    setRating(id);
    window.setTimeout(() => setPhase("topics"), 260);
  };

  const toggleTopic = (id: string) => {
    tick();
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const openWrite = (d: Destination) => {
    tick();
    setDestination(d);
    setPhase("write");
  };

  const askPolish = useCallback(async () => {
    tick();
    setPolishing(true);
    setSuggestion(null);
    polishAbort.current?.abort();
    const controller = new AbortController();
    polishAbort.current = controller;
    try {
      const res = await fetch("/api/survey/polish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // ★・話題タグ・店名は渡さない。本文だけ
        body: JSON.stringify({ body: body.trim() }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { text?: string | null };
      // 検査に落ちたときは**何も出さない**。エラー文言も出さない
      if (data.text) setSuggestion(data.text);
    } catch {
      // 何も出さない
    } finally {
      setPolishing(false);
      setPolishUses((n) => n + 1);
    }
  }, [body]);

  const adopt = () => {
    if (!suggestion) return;
    tick();
    setBeforeAdopt(body);
    setBody(suggestion);
    setSuggestion(null);
    setAdopted(true);
  };

  const undo = () => {
    if (beforeAdopt === null) return;
    tick();
    setBody(beforeAdopt);
    setBeforeAdopt(null);
  };

  const focusInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  };

  /** 書く画面の主ボタン。Google はコピーしてから完了へ、お店はそのまま完了へ */
  const finishWrite = async () => {
    tick();
    if (destination === "store") {
      setPhase("done");
      return;
    }
    let copiedOk = true;
    if (body.trim()) {
      try {
        await navigator.clipboard.writeText(body.trim());
      } catch {
        // コピーできていないのに「コピーしました」と出すと、貼り付ける段で必ず詰まる（v4 のレビュー）
        copiedOk = false;
      }
    }
    setCopied(copiedOk && body.trim() !== "");
    finishTimer.current = window.setTimeout(() => setPhase("done"), 1600);
  };

  const cancelFinish = useCallback(() => {
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    finishTimer.current = null;
    setCopied(false);
  }, []);

  useEffect(
    () => () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      polishAbort.current?.abort();
    },
    [],
  );

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <div
        className="sticky top-0 z-20 w-full px-[var(--product-space-20)] pb-[var(--product-space-8)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        <p className="text-center text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {STORE_NAME}
        </p>
      </div>

      {phase === "rating" ? <RatingStep selected={rating} onSelect={chooseRating} /> : null}

      {phase === "topics" ? (
        <TopicsStep
          ratingLabel={ratingLabel}
          onChangeRating={() => {
            tick();
            setPhase("rating");
          }}
          topics={topics}
          onToggleTopic={toggleTopic}
          onNext={() => {
            tick();
            setPhase("destination");
          }}
        />
      ) : null}

      {phase === "destination" ? (
        <DestinationStep
          onStarOnly={() => {
            tick();
            setDestination("google");
            setPhase("starOnly");
          }}
          onStoreAsIs={() => {
            tick();
            setDestination("store");
            setPhase("storeConfirm");
          }}
          onWrite={openWrite}
          onBack={() => {
            tick();
            setPhase("topics");
          }}
        />
      ) : null}

      {phase === "starOnly" ? (
        <StarOnlyStep
          onBack={() => setPhase("destination")}
          onFinish={() => {
            tick();
            setPhase("done");
          }}
        />
      ) : null}

      {phase === "write" ? (
        <WriteStep
          destination={destination}
          body={body}
          onChangeBody={(v) => {
            setBody(v);
            setSuggestion(null);
            // 採用したあとに自分で書き足してから「もどす」を押すと、書き足したぶんまで消える（v4 のレビュー）
            if (beforeAdopt !== null) setBeforeAdopt(null);
          }}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          textareaRef={textareaRef}
          placeholder={placeholder}
          question={question}
          exitHint={exitHint}
          onFocusInput={focusInput}
          canPolish={canPolish}
          polishing={polishing}
          suggestion={suggestion}
          onPolish={askPolish}
          onAdopt={adopt}
          onUndo={undo}
          canUndo={beforeAdopt !== null}
          copied={copied}
          onBack={() => {
            cancelFinish();
            setPhase("destination");
          }}
          onFinish={finishWrite}
        />
      ) : null}

      {phase === "storeConfirm" ? (
        <StoreConfirmStep
          ratingLabel={ratingLabel}
          topics={topics}
          onBack={() => setPhase("destination")}
          onFinish={() => {
            tick();
            setPhase("done");
          }}
        />
      ) : null}

      {phase === "done" ? <DoneStep destination={destination} /> : null}
    </div>
  );
}

/* ── ① 評価 ─────────────────────────────────────────
   v4 と同じ。開いた瞬間に1タップ目が押せる。選ぶと 260ms 後に自動で次へ。 */

function RatingStep({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          今日はいかがでしたか？
        </h1>
        <p className="text-sm font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
          タップだけで終わります。書くのは自由です。
        </p>
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        {RATING_CHOICES.map((choice, i) => {
          const isSelected = selected === choice.id;
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
    </div>
  );
}

/* ── ② 話題 ─────────────────────────────────────────
   v4 の S2 から本文欄を抜いたもの。★と合わせて、全員が答える設問はこの2つだけ。
   ★が低い人も同じ画面で答えられるよう「良かった点」ではなく「当てはまるもの」と聞く。 */

function TopicsStep({
  ratingLabel,
  onChangeRating,
  topics,
  onToggleTopic,
  onNext,
}: {
  ratingLabel: string;
  onChangeRating: () => void;
  topics: string[];
  onToggleTopic: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-24)] pt-[var(--product-space-8)]">
        {/* 押し間違いの救済。取り消せることが次の画面に見えていないと、誤タップが不信に変わる */}
        <div className="flex w-full items-center justify-between">
          <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            今日の評価：<span style={{ color: "var(--product-color-text-primary)" }}>{ratingLabel}</span>
          </p>
          <button
            type="button"
            onClick={onChangeRating}
            className="flex items-center gap-[var(--product-space-4)] px-[var(--product-space-8)] text-sm font-bold underline"
            style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
          >
            <BackIcon className="size-3.5" />
            変更
          </button>
        </div>

        <div className="flex w-full flex-col gap-[var(--product-space-12)]">
          <div className="flex w-full flex-col gap-[var(--product-space-2)]">
            <h1 className="text-lg font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
              当てはまるものがあれば選んでください
            </h1>
            <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              いくつでも。選ばなくても進めます。
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-[var(--product-space-8)]">
            {TOPIC_TAGS.map((tag) => {
              const isSelected = topics.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onToggleTopic(tag.id)}
                  className="review-rise flex items-center gap-[var(--product-space-8)] rounded-[var(--product-radius-full)] border-solid px-[var(--product-space-16)] py-[var(--product-space-8)] transition-transform duration-100 active:scale-95"
                  style={{
                    minHeight: "var(--product-touch-min)",
                    backgroundColor: isSelected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                    borderWidth: isSelected ? 2 : 1.5,
                    borderColor: isSelected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
                  }}
                >
                  {isSelected ? (
                    <CheckMarkIcon className="review-pop size-3.5" style={{ color: "var(--review-accent-primary)" }} />
                  ) : null}
                  <span
                    className="text-sm font-bold"
                    style={{ color: isSelected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)" }}
                  >
                    {tag.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="sticky bottom-0 z-10 w-full px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        <button
          type="button"
          onClick={onNext}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">次へ</span>
        </button>
      </div>
    </div>
  );
}

/* ── ③ 届け先（2枚の扉） ───────────────────────────────
   2枚は**同じ大きさ・同じ形・同じ書式**。並び順は★によらず固定（案I）。
   どちらの扉にも「書かずに届ける（主ボタン）」と「文章も書く」を同じ言い方で置く。
   ★だけの強調は、Google の扉の中の主ボタンで行う（2026-09-26 天真の決定）。 */

function DestinationStep({
  onStarOnly,
  onStoreAsIs,
  onWrite,
  onBack,
}: {
  onStarOnly: () => void;
  onStoreAsIs: () => void;
  onWrite: (d: Destination) => void;
  onBack: () => void;
}) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        どこに届けますか？
      </h1>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <DoorCard
          title="Googleマップに投稿"
          note="だれでも読めます"
          primaryLabel="★だけで投稿する"
          onPrimary={onStarOnly}
          onWrite={() => onWrite("google")}
          delay={0}
        />
        <DoorCard
          title="お店にだけ届ける"
          note="お店の人だけが読みます"
          primaryLabel="このまま届ける"
          onPrimary={onStoreAsIs}
          onWrite={() => onWrite("store")}
          delay={60}
        />
      </div>
      <p className="text-center text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        どちらを選んでも、ご回答はお店に届いています
      </p>
      <button
        type="button"
        onClick={onBack}
        className="self-center px-[var(--product-space-16)] text-sm font-bold underline"
        style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
      >
        もどる
      </button>
    </div>
  );
}

function DoorCard({
  title,
  note,
  primaryLabel,
  onPrimary,
  onWrite,
  delay,
}: {
  title: string;
  note: string;
  primaryLabel: string;
  onPrimary: () => void;
  onWrite: () => void;
  delay: number;
}) {
  return (
    <div
      className="review-rise flex w-full flex-col gap-[var(--product-space-12)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
      style={{
        animationDelay: `${delay}ms`,
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--product-color-border-default)",
      }}
    >
      <div className="flex w-full flex-col gap-[var(--product-space-2)]">
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </p>
        <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          {note}
        </p>
      </div>
      <button
        type="button"
        onClick={onPrimary}
        className="flex h-[48px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
        style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
      >
        <span className="text-base font-bold">{primaryLabel}</span>
      </button>
      <button
        type="button"
        onClick={onWrite}
        className="flex w-full items-center justify-center gap-[var(--product-space-4)] text-sm font-bold"
        style={{ minHeight: "var(--product-touch-min)", color: "var(--review-accent-action)" }}
      >
        文章も書く
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}

/* ── ④a ★だけ ─────────────────────────────────────────
   いちばん短い道。★はこちらからGoogleに引き継げない（Googleの仕様）ので、Googleで★を選ぶことを先に伝える。 */

function StarOnlyStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        Googleマップを開きます
      </h1>
      <p className="text-[15px] font-medium leading-[1.9]" style={{ color: "var(--product-color-text-primary)" }}>
        Googleの画面で★を選んで、「投稿」を押すと完了です。
      </p>
      <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
        文章は書かなくても投稿できます。
        <br />
        選んだものはGoogleには送られません。お店にだけ届きます。
      </p>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <button
          type="button"
          onClick={onFinish}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">Googleマップを開く</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="self-center px-[var(--product-space-16)] text-sm font-bold underline"
          style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
        >
          もどる
        </button>
      </div>
    </div>
  );
}

/* ── ④b 書く画面（2枚の扉で共通。届け先だけが違う） ─────────────
   AIは3つだけ：続きを聞く（問いは本文に入らない）／整える（助詞と句読点だけ）／マイクの案内。
   白紙のあいだは、静的な問い（プレースホルダ）だけでAIは現れない。
   問いは入力欄のすぐ下に出す。スマホではキーボードが画面の下半分を覆うため。 */

function WriteStep({
  destination,
  body,
  onChangeBody,
  onCompositionStart,
  onCompositionEnd,
  textareaRef,
  placeholder,
  question,
  exitHint,
  onFocusInput,
  canPolish,
  polishing,
  suggestion,
  onPolish,
  onAdopt,
  onUndo,
  canUndo,
  copied,
  onBack,
  onFinish,
}: {
  destination: Destination;
  body: string;
  onChangeBody: (v: string) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  question: string | null;
  exitHint: boolean;
  onFocusInput: () => void;
  canPolish: boolean;
  polishing: boolean;
  suggestion: string | null;
  onPolish: () => void;
  onAdopt: () => void;
  onUndo: () => void;
  canUndo: boolean;
  copied: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const hasBody = body.trim() !== "";
  const label = DESTINATION_LABEL[destination];
  const finishLabel =
    destination === "store" ? "お店にとどける" : hasBody ? "コピーしてGoogleを開く" : "Googleマップを開く";

  return (
    <div className="review-slide-in flex w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-[var(--product-space-12)] px-[var(--product-space-20)] pb-[var(--product-space-24)] pt-[var(--product-space-4)]">
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-[var(--product-space-4)] pr-[var(--product-space-8)] text-sm font-bold"
            style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
          >
            <BackIcon className="size-4" />
            もどる
          </button>
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            届け先：<span className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>{label.title}</span>（{label.note}）
          </p>
        </div>

        <h1 className="text-lg font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          あなたの言葉で
        </h1>

        {/* プレースホルダは**例文ではなく問い**。白紙のあいだAIは呼ばない */}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => onChangeBody(e.target.value)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          rows={4}
          placeholder={placeholder}
          className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] text-[15px] leading-[1.8] outline-none focus:ring-2 focus:ring-[color:var(--review-accent-primary)]"
          style={{
            backgroundColor: "var(--product-color-surface-white)",
            borderColor: "var(--review-accent-primary)",
            color: "var(--product-color-text-primary)",
          }}
        />

        {question && !suggestion ? <AskChip question={question} onFocusInput={onFocusInput} /> : null}
        {exitHint && !suggestion ? (
          <p role="status" className="review-rise text-sm font-bold" style={{ color: "var(--review-accent-action)" }}>
            ここまでで投稿できます
          </p>
        ) : null}

        <div className="flex w-full flex-wrap items-center gap-[var(--product-space-8)]">
          {/* 白紙のあいだはこのボタン自体が存在しない＝AIが白紙から文を作る経路が構造的に無い */}
          {canPolish || polishing ? (
            <button
              type="button"
              onClick={onPolish}
              disabled={polishing}
              aria-busy={polishing}
              className="review-rise rounded-[var(--product-radius-full)] border-[1.5px] border-solid px-[var(--product-space-16)] transition-transform duration-100 active:scale-95"
              style={{
                minHeight: "var(--product-touch-min)",
                opacity: polishing ? 0.5 : 1,
                backgroundColor: "var(--product-color-surface-white)",
                borderColor: "var(--review-accent-primary)",
                color: "var(--review-accent-action)",
              }}
            >
              <span className="text-sm font-bold">整える</span>
            </button>
          ) : null}
          <p
            className="flex items-center gap-[var(--product-space-4)] text-xs font-medium"
            style={{ color: "var(--product-color-text-secondary)" }}
          >
            <MicIcon className="size-4 shrink-0" />
            キーボードのマイクで、話しても書けます
          </p>
        </div>

        {suggestion ? <SuggestLine text={suggestion} onAdopt={onAdopt} onUndo={onUndo} canUndo={canUndo} /> : null}
        {!suggestion && canUndo ? (
          <button
            type="button"
            onClick={onUndo}
            className="self-end px-[var(--product-space-8)] text-sm font-bold underline"
            style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
          >
            もどす
          </button>
        ) : null}

        <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
          単語を並べるだけでも大丈夫です。話しことばのままで大丈夫です。
          <br />
          お名前など、個人が特定できることは書かないでください。
          {destination === "google" ? (
            <>
              <br />
              書いた文章は、お店にも届きます。
            </>
          ) : null}
        </p>
      </div>

      <div
        className="sticky bottom-0 z-10 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        {copied && hasBody ? (
          <p role="status" className="review-pop text-center text-sm font-bold" style={{ color: "var(--review-accent-action)" }}>
            文章をコピーしました
          </p>
        ) : null}
        <button
          type="button"
          onClick={onFinish}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">{finishLabel}</span>
        </button>
      </div>
    </div>
  );
}

/* ── ④c お店へ（このまま届ける） ────────────────────────
   店に何が届くのかを送信前に見せる。Google 側（★だけ）と同じ1タップで終わらせ、2つの出口の重さを揃える。 */

function StoreConfirmStep({
  ratingLabel,
  topics,
  onBack,
  onFinish,
}: {
  ratingLabel: string;
  topics: string[];
  onBack: () => void;
  onFinish: () => void;
}) {
  const labels = topics.map((id) => topicTag(id)?.label ?? "").filter(Boolean);
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        お店にとどく内容
      </h1>
      <div
        className="flex w-full flex-col gap-[var(--product-space-16)] rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)]"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--product-color-border-default)" }}
      >
        <Field label="今日の評価">{ratingLabel}</Field>
        {labels.length > 0 ? <Field label="選んだこと">{labels.join("／")}</Field> : null}
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <button
          type="button"
          onClick={onFinish}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">とどける</span>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="self-center px-[var(--product-space-16)] text-sm font-bold underline"
          style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
        >
          もどる
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[var(--product-space-4)]">
      <p className="text-xs font-bold" style={{ color: "var(--product-color-text-tertiary)" }}>
        {label}
      </p>
      <p className="text-[15px] font-medium leading-[1.8]" style={{ color: "var(--product-color-text-primary)" }}>
        {children}
      </p>
    </div>
  );
}

/* ── ⑤ 完了 ─────────────────────────────────────────
   追加のタップを一切要求しない。 */

function DoneStep({ destination }: { destination: Destination }) {
  return (
    <div className="review-rise flex w-full flex-1 flex-col items-center justify-center gap-[var(--product-space-20)] px-[var(--product-space-24)] py-[var(--product-space-40)]">
      <CheckCircleOutlineIcon className="size-16 shrink-0" />
      <p className="text-center text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        ありがとうございました
      </p>
      <p className="text-center text-sm font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
        {destination === "google"
          ? "このあとGoogleマップの投稿画面が開きます"
          : "いただいた内容は、お店の担当者が確認します"}
      </p>
      <p className="text-center text-xs font-medium" style={{ color: "var(--product-color-text-muted)" }}>
        これは検証用のデモです。回答は保存されません
      </p>
    </div>
  );
}
