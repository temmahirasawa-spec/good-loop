"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AiBadge } from "@/components/rating-flow/AiBadge";
import { CheckCircleOutlineIcon } from "@/components/rating-flow/icons";
import { BackIcon, CheckMarkIcon, MicIcon } from "@/components/demo/icons";
import { STORE_NAME } from "@/lib/demo/survey-data";
import { markInsertions, withPeriod, type MarkedChar } from "@/lib/survey/insertions";
import { DEFAULT_QUESTIONS, TOPIC_TAGS, topicTag } from "@/lib/survey/topic-questions";

/**
 * アンケート v5 のプロトタイプ（docs/specs/survey-v5.md）。
 *
 * **検証専用。DBには一切書き込まない。** 本番のお客様導線（/r/[storeSlug]）には影響しない。
 * v4（/demo/v4）はそのまま残してあるので、並べて比べられる。
 *
 * 2026-09-26 の決定（天真）と、同日の iPhone 実機での所感を反映した形:
 *   ・評価は Google マップと同じく**★を5つ横に並べて選ぶ**（★の記憶のまま Google へ行ってもらう）
 *   ・届け先の2枚の扉は同じ形。どちらも上が塗りの「文章も書く」、下が線の「書かずに届ける」
 *   ・書く画面は**選んだ話題の数だけ欄を分ける**（料理について／接客について…）
 *   ・AIの役割は**最後に「つなげる」**。各欄の言葉に助詞と句読点だけを足して1つの文章にし、
 *     **AIが足した文字に色を付けて**見せる。中身は足さない
 *   ・書いている途中に問いを出すAI（A1・A2）は外した（実機で「割り込まれてうっとうしい」「問いが的外れなことがある」）
 */

type Phase = "rating" | "topics" | "destination" | "starOnly" | "write" | "join" | "storeConfirm" | "done";
type Destination = "google" | "store";
type Level = 1 | 2 | 3 | 4 | 5;

const LEVELS: Level[] = [1, 2, 3, 4, 5];
/** 本番の評価ボタン（components/rating-flow/RatingButton.tsx）と同じ言葉 */
const LEVEL_LABEL: Record<Level, string> = { 1: "不満", 2: "やや不満", 3: "ふつう", 4: "満足", 5: "とても満足" };
/** 話題を1つも選ばなかったときの欄 */
const GENERAL_FIELD = "general";

/** 短い触覚。対応していない端末では何も起きない */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

/** 1つの欄を整えた結果。AIの出力が検査を通らなかった欄は、本人の言葉のまま（色なし） */
type JoinedPart = { chars: MarkedChar[]; byAi: boolean };

export function V5Survey() {
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState<Level | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>("google");
  const [fragments, setFragments] = useState<Record<string, string>>({});
  /** 問いのローテーション。同じ店で同じ問いが並ばないようにする */
  const [rotation, setRotation] = useState(0);

  // ── つなげる ──
  const [joining, setJoining] = useState(false);
  const [parts, setParts] = useState<JoinedPart[] | null>(null);
  const [useAi, setUseAi] = useState(true);
  /** 本人がつなげた文を直したら、その文が最終版になる（色は消える） */
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const joinAbort = useRef<AbortController | null>(null);
  const finishTimer = useRef<number | null>(null);

  // hydration のずれを避けるため、乱数はマウント後に決める
  useEffect(() => {
    setRotation(Math.floor(Math.random() * 3));
  }, []);

  useEffect(
    () => () => {
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      joinAbort.current?.abort();
    },
    [],
  );

  /** 欄は選んだ順。1つも選んでいなければ「今日のこと」の1欄 */
  const fieldIds = topics.length > 0 ? topics : [GENERAL_FIELD];
  const filled = fieldIds.map((id) => (fragments[id] ?? "").trim()).filter((t) => t !== "");
  const plainText = filled.map(withPeriod).join("");
  const aiText = parts ? parts.map((p) => p.chars.map((c) => c.char).join("")).join("") : null;
  const finalText = edited ?? (useAi && aiText ? aiText : plainText);

  const chooseRating = (level: Level) => {
    tick();
    setRating(level);
    // ★が塗られたのを見てから進む
    window.setTimeout(() => setPhase("topics"), 450);
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

  /**
   * 各欄を「整える」AI（v4 の /api/survey/polish）に1つずつ並列で渡し、返ってきた1文をつなげる。
   * 渡すのは**その欄の文字列だけ**。★・話題タグ・店名は渡さない。
   * 検査に落ちた欄・通信に失敗した欄は、本人の言葉のまま（句点だけ足す）でつなげる。
   */
  const startJoin = useCallback(async () => {
    tick();
    const texts = filled;
    setPhase("join");
    setEdited(null);
    setUseAi(true);
    setParts(null);
    setCopied(false);
    setJoining(true);
    joinAbort.current?.abort();
    const controller = new AbortController();
    joinAbort.current = controller;

    const results = await Promise.all(
      texts.map(async (text): Promise<JoinedPart> => {
        try {
          const res = await fetch("/api/survey/polish", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: text }),
            signal: controller.signal,
          });
          const data = (await res.json()) as { text?: string | null };
          if (data.text) return { chars: markInsertions(text, withPeriod(data.text)), byAi: true };
        } catch {
          // 本人の言葉のままにする
        }
        return { chars: Array.from(withPeriod(text)).map((char) => ({ char, inserted: false })), byAi: false };
      }),
    );
    if (controller.signal.aborted) return;
    // 1つもAIが整えられなかったときは「AIでつなげた」とは言わない
    setParts(results.some((p) => p.byAi) ? results : null);
    setJoining(false);
  }, [filled]);

  /** Google はコピーしてから完了へ、お店はそのまま完了へ */
  const finish = async (text: string) => {
    tick();
    if (destination === "store") {
      setPhase("done");
      return;
    }
    let copiedOk = true;
    if (text.trim()) {
      try {
        await navigator.clipboard.writeText(text.trim());
      } catch {
        // コピーできていないのに「コピーしました」と出すと、貼り付ける段で必ず詰まる（v4 のレビュー）
        copiedOk = false;
      }
    }
    setCopied(copiedOk && text.trim() !== "");
    finishTimer.current = window.setTimeout(() => setPhase("done"), 1600);
  };

  const cancelFinish = useCallback(() => {
    if (finishTimer.current) window.clearTimeout(finishTimer.current);
    finishTimer.current = null;
    setCopied(false);
  }, []);

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
          rating={rating}
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
          rating={rating}
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
          fieldIds={fieldIds}
          fragments={fragments}
          rotation={rotation}
          onChange={(id, v) => setFragments((prev) => ({ ...prev, [id]: v }))}
          hasText={filled.length > 0}
          onBack={() => setPhase("destination")}
          onJoin={startJoin}
          onFinishEmpty={() => finish("")}
        />
      ) : null}

      {phase === "join" ? (
        <JoinStep
          destination={destination}
          rating={rating}
          joining={joining}
          parts={parts}
          useAi={useAi}
          onToggleAi={() => {
            tick();
            setUseAi((v) => !v);
          }}
          plainText={plainText}
          edited={edited}
          onEdit={(v) => setEdited(v)}
          finalText={finalText}
          copied={copied}
          onBack={() => {
            cancelFinish();
            joinAbort.current?.abort();
            setPhase("write");
          }}
          onFinish={() => finish(finalText)}
        />
      ) : null}

      {phase === "storeConfirm" ? (
        <StoreConfirmStep
          rating={rating}
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

/* ── ★ ─────────────────────────────────────────────
   色は本番の評価ボタン（RatingButton）と同じ：塗り＝status-warning、空き＝text-tertiary の線。 */

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ color: filled ? "var(--product-color-status-warning)" : "var(--product-color-text-tertiary)" }}
    >
      <path
        d="M12 2.8l2.83 5.9 6.47.78-4.76 4.46 1.22 6.4L12 17.2l-5.76 3.14 1.22-6.4-4.76-4.46 6.47-.78L12 2.8z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 「今日の評価」などに添える小さな★5つ */
function StarsInline({ level }: { level: Level }) {
  return (
    <span className="inline-flex items-center gap-[var(--product-space-2)] align-[-2px]" aria-label={`★${level}`}>
      {LEVELS.map((n) => (
        <StarIcon key={n} filled={n <= level} className="size-4" />
      ))}
    </span>
  );
}

/* ── ① 評価 ─────────────────────────────────────────
   Google マップで★を付けるときと同じ体験に寄せる（2026-09-26 天真の実機所感）。
   ★の数の記憶のまま Google へ行ってもらうため、5つ横に並べてタップで塗る。 */

function RatingStep({ selected, onSelect }: { selected: Level | null; onSelect: (level: Level) => void }) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-24)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
          今日はいかがでしたか？
        </h1>
        <p className="text-sm font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
          タップだけで終わります。書くのは自由です。
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="5段階の評価"
        className="flex w-full items-center justify-between rounded-[var(--product-radius-md)] border-[1.5px] border-solid px-[var(--product-space-8)] py-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--product-color-border-default)" }}
      >
        {LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected === n}
            aria-label={`★${n}（${LEVEL_LABEL[n]}）`}
            onClick={() => onSelect(n)}
            className="flex flex-1 items-center justify-center transition-transform duration-100 active:scale-90"
            style={{ minHeight: 56 }}
          >
            <StarIcon filled={selected !== null && n <= selected} className="size-11" />
          </button>
        ))}
      </div>

      <p
        className="text-center text-base font-bold"
        aria-live="polite"
        style={{ color: selected ? "var(--product-color-text-primary)" : "var(--product-color-text-tertiary)" }}
      >
        {selected ? LEVEL_LABEL[selected] : "★をタップしてください"}
      </p>
    </div>
  );
}

/* ── ② 話題 ─────────────────────────────────────────
   ★と合わせて、全員が答える設問はこの2つだけ。
   ★が低い人も同じ画面で答えられるよう「良かった点」ではなく「当てはまるもの」と聞く。
   ここで選んだ話題の数だけ、書く画面の欄ができる。 */

function TopicsStep({
  rating,
  onChangeRating,
  topics,
  onToggleTopic,
  onNext,
}: {
  rating: Level | null;
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
          <p className="flex items-center gap-[var(--product-space-8)] text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            今日の評価
            {rating ? <StarsInline level={rating} /> : null}
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

      <StickyBar>
        <PrimaryButton onClick={onNext}>次へ</PrimaryButton>
      </StickyBar>
    </div>
  );
}

/* ── ③ 届け先（2枚の扉） ───────────────────────────────
   2枚は**同じ大きさ・同じ形・同じ書式**。並び順は★によらず固定（案I）。
   どちらの扉も、上が塗りの「文章も書く」、下が線の「書かずに届ける」（2026-09-26 天真の実機所感）。 */

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
          quietLabel="★だけで投稿する"
          onWrite={() => onWrite("google")}
          onQuiet={onStarOnly}
          delay={0}
        />
        <DoorCard
          title="お店にだけ届ける"
          note="お店の人だけが読みます"
          quietLabel="このまま届ける"
          onWrite={() => onWrite("store")}
          onQuiet={onStoreAsIs}
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
  quietLabel,
  onWrite,
  onQuiet,
  delay,
}: {
  title: string;
  note: string;
  quietLabel: string;
  onWrite: () => void;
  onQuiet: () => void;
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
      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        <button
          type="button"
          onClick={onWrite}
          className="flex h-[48px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">文章も書く</span>
        </button>
        <button
          type="button"
          onClick={onQuiet}
          className="flex h-[48px] w-full items-center justify-center rounded-[var(--product-radius-sm)] border-[1.5px] border-solid transition-transform duration-100 active:scale-[0.99]"
          style={{
            backgroundColor: "var(--product-color-surface-white)",
            borderColor: "var(--review-accent-primary)",
            color: "var(--review-accent-action)",
          }}
        >
          <span className="text-base font-bold">{quietLabel}</span>
        </button>
      </div>
    </div>
  );
}

/* ── ④a ★だけ ─────────────────────────────────────────
   ★はこちらから Google に引き継げない（Google の仕様）。選んだ★を添えて、記憶のまま Google へ行ってもらう。
   「同じ数を選んでください」とは書かない（評価の中身に触れないため）。 */

function StarOnlyStep({ rating, onBack, onFinish }: { rating: Level | null; onBack: () => void; onFinish: () => void }) {
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        Googleマップを開きます
      </h1>
      {rating ? <RatingReminder rating={rating} /> : null}
      <p className="text-[15px] font-medium leading-[1.9]" style={{ color: "var(--product-color-text-primary)" }}>
        Googleの画面で★を選んで、「投稿」を押すと完了です。
      </p>
      <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
        文章は書かなくても投稿できます。
        <br />
        選んだものはGoogleには送られません。お店にだけ届きます。
      </p>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <PrimaryButton onClick={onFinish}>Googleマップを開く</PrimaryButton>
        <BackLink onClick={onBack} />
      </div>
    </div>
  );
}

function RatingReminder({ rating }: { rating: Level }) {
  return (
    <div
      className="flex w-full items-center justify-between rounded-[var(--product-radius-md)] px-[var(--product-space-16)] py-[var(--product-space-12)]"
      style={{ backgroundColor: "var(--product-color-bg-secondary)" }}
    >
      <p className="text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        あなたの評価
      </p>
      <p className="flex items-center gap-[var(--product-space-8)] text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        <StarsInline level={rating} />
        {LEVEL_LABEL[rating]}
      </p>
    </div>
  );
}

/* ── ④b 書く画面（2枚の扉で共通。届け先だけが違う） ─────────────
   選んだ話題の数だけ欄を分ける（2026-09-26 天真の案）。欄ごとの問いは v4 の静的な問いで、AIは呼ばない。
   書いている途中にAIは一度も出てこない。AIが出るのは次の「つなげる」画面だけ。 */

function WriteStep({
  destination,
  fieldIds,
  fragments,
  rotation,
  onChange,
  hasText,
  onBack,
  onJoin,
  onFinishEmpty,
}: {
  destination: Destination;
  fieldIds: string[];
  fragments: Record<string, string>;
  rotation: number;
  onChange: (id: string, value: string) => void;
  hasText: boolean;
  onBack: () => void;
  onJoin: () => void;
  onFinishEmpty: () => void;
}) {
  const emptyLabel = destination === "store" ? "お店にとどける" : "Googleマップを開く";
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-[var(--product-space-16)] px-[var(--product-space-20)] pb-[var(--product-space-24)] pt-[var(--product-space-4)]">
        <TopRow destination={destination} onBack={onBack} />

        <div className="flex w-full flex-col gap-[var(--product-space-4)]">
          <h1 className="text-lg font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
            あなたの言葉で
          </h1>
          <p className="text-sm font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
            選んだことごとに、ひとことずつ。単語だけでも大丈夫です。
          </p>
          <p className="flex items-center gap-[var(--product-space-4)] text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            <MicIcon className="size-4 shrink-0" />
            キーボードのマイクで、話しても書けます
          </p>
        </div>

        {fieldIds.map((id) => {
          const tag = id === GENERAL_FIELD ? null : topicTag(id);
          const label = tag ? `${tag.label}について` : "今日のこと";
          const questions = tag ? tag.questions : DEFAULT_QUESTIONS;
          return (
            <label key={id} className="flex w-full flex-col gap-[var(--product-space-8)]">
              <span className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {label}
              </span>
              {/* プレースホルダは**例文ではなく問い**。欄ごとに違う問いになる */}
              <textarea
                value={fragments[id] ?? ""}
                onChange={(e) => onChange(id, e.target.value)}
                rows={2}
                placeholder={questions[rotation % questions.length]}
                className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] text-[15px] leading-[1.8] outline-none focus:ring-2 focus:ring-[color:var(--review-accent-primary)]"
                style={{
                  backgroundColor: "var(--product-color-surface-white)",
                  borderColor: "var(--product-color-border-default)",
                  color: "var(--product-color-text-primary)",
                }}
              />
            </label>
          );
        })}

        <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
          空いている欄があっても大丈夫です。
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

      <StickyBar>
        {hasText ? (
          <PrimaryButton onClick={onJoin}>AIでつなげる</PrimaryButton>
        ) : (
          <PrimaryButton onClick={onFinishEmpty}>{emptyLabel}</PrimaryButton>
        )}
      </StickyBar>
    </div>
  );
}

/* ── ④b' つなげる ────────────────────────────────────
   各欄の言葉を「整える」AI（v4）に1つずつ通し、1つの文章にする。AIが足せるのは助詞と句読点だけで、
   検査はサーバー側（polish-guard.ts）。**AIが足した文字に色を付けて**、中身を足していないことを本人に見せる。
   すぐに「元の言葉のまま」にも戻せる。直した時点で、本人の文になる（色は消える）。 */

function JoinStep({
  destination,
  rating,
  joining,
  parts,
  useAi,
  onToggleAi,
  plainText,
  edited,
  onEdit,
  finalText,
  copied,
  onBack,
  onFinish,
}: {
  destination: Destination;
  rating: Level | null;
  joining: boolean;
  parts: JoinedPart[] | null;
  useAi: boolean;
  onToggleAi: () => void;
  plainText: string;
  edited: string | null;
  onEdit: (value: string) => void;
  finalText: string;
  copied: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const showAi = !joining && parts !== null && useAi && edited === null;
  const finishLabel = destination === "store" ? "お店にとどける" : "コピーしてGoogleを開く";

  return (
    <div className="review-slide-in flex w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-[var(--product-space-16)] px-[var(--product-space-20)] pb-[var(--product-space-24)] pt-[var(--product-space-4)]">
        <TopRow destination={destination} onBack={onBack} />

        <div className="flex w-full items-start justify-between gap-[var(--product-space-12)]">
          <h1 className="text-lg font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
            {destination === "store" ? "お店にとどく文章" : "この文章で投稿します"}
          </h1>
          {showAi ? <AiBadge label="AIがつなげました" /> : null}
        </div>

        {editing ? (
          <textarea
            value={finalText}
            onChange={(e) => onEdit(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] text-[15px] leading-[1.9] outline-none focus:ring-2 focus:ring-[color:var(--review-accent-primary)]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--review-accent-primary)",
              color: "var(--product-color-text-primary)",
            }}
          />
        ) : (
          <div
            aria-busy={joining}
            className="w-full rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-16)] text-[15px] leading-[2]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--product-color-border-default)",
              color: "var(--product-color-text-primary)",
              opacity: joining ? 0.55 : 1,
            }}
          >
            {showAi && parts
              ? parts.map((part, k) => (
                  <span key={k}>
                    {part.chars.map((c, i) =>
                      c.inserted ? (
                        <span
                          key={i}
                          className="rounded-[3px] px-[1px] font-bold"
                          style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-action)" }}
                        >
                          {c.char}
                        </span>
                      ) : (
                        <span key={i}>{c.char}</span>
                      ),
                    )}
                  </span>
                ))
              : edited ?? plainText}
          </div>
        )}

        {showAi && !editing ? (
          <p className="text-xs font-medium leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
            <span
              className="mr-[var(--product-space-4)] rounded-[3px] px-[var(--product-space-4)] font-bold"
              style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-action)" }}
            >
              色の付いた文字
            </span>
            が、AIが足したところです。足したのは助詞と句読点だけで、中身はあなたの言葉のままです。
          </p>
        ) : null}

        {!joining ? (
          <div className="flex w-full flex-wrap gap-[var(--product-space-8)]">
            {parts !== null && edited === null && !editing ? (
              <SmallButton onClick={onToggleAi}>{useAi ? "元の言葉のまま使う" : "AIでつなげた文を使う"}</SmallButton>
            ) : null}
            {!editing ? (
              <SmallButton
                onClick={() => {
                  tick();
                  setEditing(true);
                  // 直し始めた時点の文を、本人の文として持つ
                  onEdit(finalText);
                }}
              >
                直す
              </SmallButton>
            ) : null}
          </div>
        ) : null}

        {destination === "google" && rating ? (
          <div className="flex w-full flex-col gap-[var(--product-space-8)]">
            <RatingReminder rating={rating} />
            <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
              Googleの画面で★を選び、文章を貼り付けて「投稿」を押すと完了です。
            </p>
          </div>
        ) : null}
      </div>

      <StickyBar>
        {copied ? (
          <p role="status" className="review-pop text-center text-sm font-bold" style={{ color: "var(--review-accent-action)" }}>
            文章をコピーしました
          </p>
        ) : null}
        <PrimaryButton onClick={onFinish} disabled={joining}>
          {finishLabel}
        </PrimaryButton>
      </StickyBar>
    </div>
  );
}

/* ── ④c お店へ（このまま届ける） ────────────────────────
   店に何が届くのかを送信前に見せる。★だけと同じ1タップで終わらせ、2つの出口の重さを揃える。 */

function StoreConfirmStep({
  rating,
  topics,
  onBack,
  onFinish,
}: {
  rating: Level | null;
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
        {rating ? (
          <Field label="今日の評価">
            <span className="flex items-center gap-[var(--product-space-8)]">
              <StarsInline level={rating} />
              {LEVEL_LABEL[rating]}
            </span>
          </Field>
        ) : null}
        {labels.length > 0 ? <Field label="選んだこと">{labels.join("／")}</Field> : null}
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <PrimaryButton onClick={onFinish}>とどける</PrimaryButton>
        <BackLink onClick={onBack} />
      </div>
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

/* ── 共通の部品 ─────────────────────────────────────── */

function TopRow({ destination, onBack }: { destination: Destination; onBack: () => void }) {
  const label = destination === "store" ? { title: "お店だけ", note: "お店の人だけが読みます" } : { title: "Googleマップ", note: "だれでも読めます" };
  return (
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
        届け先：
        <span className="font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {label.title}
        </span>
        （{label.note}）
      </p>
    </div>
  );
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
      style={{
        backgroundColor: "var(--review-accent-primary)",
        color: "var(--review-accent-on-primary)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="text-base font-bold">{children}</span>
    </button>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[var(--product-radius-full)] border-[1.5px] border-solid px-[var(--product-space-16)] text-sm font-bold transition-transform duration-100 active:scale-95"
      style={{
        minHeight: "var(--product-touch-min)",
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--product-color-border-default)",
        color: "var(--product-color-text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-center px-[var(--product-space-16)] text-sm font-bold underline"
      style={{ minHeight: "var(--product-touch-min)", color: "var(--product-color-text-secondary)" }}
    >
      もどる
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[var(--product-space-4)]">
      <p className="text-xs font-bold" style={{ color: "var(--product-color-text-tertiary)" }}>
        {label}
      </p>
      <div className="text-[15px] font-medium leading-[1.8]" style={{ color: "var(--product-color-text-primary)" }}>
        {children}
      </div>
    </div>
  );
}
