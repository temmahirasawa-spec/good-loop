"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleOutlineIcon } from "@/components/rating-flow/icons";
import { BackIcon, CheckMarkIcon } from "@/components/demo/icons";
import { SuggestLine } from "@/components/survey/SuggestLine";
import { RATING_CHOICES, STORE_NAME } from "@/lib/demo/survey-data";
import { TOPIC_TAGS, questionFor, topicTag } from "@/lib/survey/topic-questions";

/**
 * アンケート v4 のプロトタイプ（docs/specs/survey-v4.md）。
 *
 * **検証専用。DBには一切書き込まない。** 本番のお客様導線（/r/[storeSlug]）には影響しない。
 * v3（/demo）はそのまま残してあるので、並べて比べられる。
 *
 * v3 からの構造の変更:
 *   ・画面が3枚＋出口（v3は最大9枚）。**最短4タップで完走**（v3は21タップ）
 *   ・本文欄の手前の問いは**★と話題タグの2問だけ**
 *   ・**AIは全文を書かない。** 本人が「文にする」を押したときだけ、助詞と句読点を足した1文を灰色で出す
 *   ・**例文を1つも出さない。** 本文欄のプレースホルダは常に「問い」
 *   ・押さなければAIは**1回も呼ばれない**（最短経路ではAI呼び出し0回）
 */

type Phase = "rating" | "compose" | "destination" | "google" | "store" | "done";
type Destination = "google" | "store";

/** 短い触覚。対応していない端末では何も起きない */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

/** 「文にする」が出る条件（docs/specs/survey-v4.md §6-2） */
const SUGGEST_MIN_CHARS = 6;
const SUGGEST_IDLE_MS = 800;
/** 1セッションで押せる回数。サーバー側でもIP単位で数えている */
const SUGGEST_MAX_USES = 3;

export function V4Survey() {
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [destination, setDestination] = useState<Destination | null>(null);

  /** 問いのローテーション。同じ店で同じ問いが並ばないようにする */
  const [rotation, setRotation] = useState(0);
  /** 直前に「文にする」を押したときの本文。「もどす」で戻す */
  const [beforeAdopt, setBeforeAdopt] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestUses, setSuggestUses] = useState(0);
  const [asking, setAsking] = useState(false);
  const [idle, setIdle] = useState(false);
  const [copied, setCopied] = useState(false);

  const idleTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ★ hydration のずれを避けるため、乱数はマウント後に決める。
  //    S2 が出るのはタップ1回ぶん後なので、画面がちらつくことはない。
  useEffect(() => {
    setRotation(Math.floor(Math.random() * 3));
  }, []);

  /** 入力が止まったら idle にする（「文にする」の出現条件のひとつ） */
  useEffect(() => {
    setIdle(false);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), SUGGEST_IDLE_MS);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [body]);

  const ratingLabel = RATING_CHOICES.find((c) => c.id === rating)?.label ?? "";
  const placeholder = questionFor(topics, rotation);

  /** すでに句点で終わる整った文が2つ以上あるなら、助けは要らない */
  const sentenceCount = useMemo(() => (body.match(/。/g) ?? []).length, [body]);

  const canSuggest =
    Array.from(body.trim()).length >= SUGGEST_MIN_CHARS &&
    idle &&
    sentenceCount < 2 &&
    suggestUses < SUGGEST_MAX_USES &&
    !asking;

  const chooseRating = (id: string) => {
    tick();
    setRating(id);
    window.setTimeout(() => setPhase("compose"), 260);
  };

  const toggleTopic = (id: string) => {
    tick();
    setSuggestion(null);
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const askPolish = useCallback(async () => {
    tick();
    setAsking(true);
    setSuggestion(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
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
      setAsking(false);
      setSuggestUses((n) => n + 1);
    }
  }, [body]);

  const adopt = () => {
    if (!suggestion) return;
    tick();
    setBeforeAdopt(body);
    setBody(suggestion);
    setSuggestion(null);
  };

  const undo = () => {
    if (beforeAdopt === null) return;
    tick();
    setBody(beforeAdopt);
    setBeforeAdopt(null);
  };

  const copyAndFinish = async () => {
    tick();
    if (body.trim()) {
      try {
        await navigator.clipboard.writeText(body.trim());
      } catch {
        // コピーできなくても先へ進める
      }
    }
    setCopied(true);
    window.setTimeout(() => setPhase("done"), 1600);
  };

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

      {phase === "rating" ? (
        <RatingStep selected={rating} onSelect={chooseRating} />
      ) : null}

      {phase === "compose" ? (
        <ComposeStep
          ratingLabel={ratingLabel}
          onChangeRating={() => {
            tick();
            setPhase("rating");
          }}
          topics={topics}
          onToggleTopic={toggleTopic}
          body={body}
          onChangeBody={(v) => {
            setBody(v);
            setSuggestion(null);
          }}
          placeholder={placeholder}
          canSuggest={canSuggest}
          asking={asking}
          suggestion={suggestion}
          onAskPolish={askPolish}
          onAdopt={adopt}
          onUndo={undo}
          canUndo={beforeAdopt !== null}
          onNext={() => {
            tick();
            setPhase("destination");
          }}
        />
      ) : null}

      {phase === "destination" ? (
        <DestinationStep
          onChoose={(d) => {
            tick();
            setDestination(d);
            setPhase(d === "google" ? "google" : "store");
          }}
        />
      ) : null}

      {phase === "google" ? (
        <GoogleStep
          body={body}
          copied={copied}
          onChangeBody={setBody}
          onBack={() => setPhase("destination")}
          onFinish={copyAndFinish}
        />
      ) : null}

      {phase === "store" ? (
        <StoreStep
          ratingLabel={ratingLabel}
          topics={topics}
          body={body}
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

/* ── S1 評価（入口を兼ねる） ───────────────────────────
   v3 にあった「はじめる」の入口画面を廃止し、開いた瞬間に1タップ目が押せる状態にした。
   全員から1タップと1画面ぶんの読む量を無条件に削っている。 */

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

/* ── S2 話題と、あなたの言葉 ─────────────────────────
   本文欄の手前の問いはここで打ち止め（★と合わせて計2問）。
   話題タグは「分類」ではなく**本文欄の問いを決める切替器**として置いている。 */

function ComposeStep({
  ratingLabel,
  onChangeRating,
  topics,
  onToggleTopic,
  body,
  onChangeBody,
  placeholder,
  canSuggest,
  asking,
  suggestion,
  onAskPolish,
  onAdopt,
  onUndo,
  canUndo,
  onNext,
}: {
  ratingLabel: string;
  onChangeRating: () => void;
  topics: string[];
  onToggleTopic: (id: string) => void;
  body: string;
  onChangeBody: (v: string) => void;
  placeholder: string;
  canSuggest: boolean;
  asking: boolean;
  suggestion: string | null;
  onAskPolish: () => void;
  onAdopt: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onNext: () => void;
}) {
  const hasBody = body.trim() !== "";
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
              選ばなくても進めます。
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

        <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

        <div className="flex w-full flex-col gap-[var(--product-space-12)]">
          <h2 className="text-lg font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
            あなたの言葉
            <span className="ml-[var(--product-space-8)] text-sm font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              書かなくても進めます
            </span>
          </h2>

          {/* プレースホルダは**例文ではなく問い**。選んだ話題で差し替わる */}
          <textarea
            value={body}
            onChange={(e) => onChangeBody(e.target.value)}
            rows={4}
            placeholder={placeholder}
            className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] text-[15px] leading-[1.8]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--product-color-border-default)",
              color: "var(--product-color-text-primary)",
            }}
          />

          <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
            単語を並べるだけでも大丈夫です。話しことばのままで大丈夫です。
            <br />
            キーボードのマイクで、話して入れることもできます。
            <br />
            お名前など、個人が特定できることは書かないでください。
          </p>

          {/* 白紙のあいだはこのボタン自体が存在しない＝AIが白紙から文を作る経路が構造的に無い */}
          {canSuggest || asking ? (
            <button
              type="button"
              onClick={onAskPolish}
              disabled={asking}
              aria-busy={asking}
              className="review-rise self-start rounded-[var(--product-radius-sm)] border-[1.5px] border-solid px-[var(--product-space-16)] transition-transform duration-100 active:scale-95"
              style={{
                minHeight: "var(--product-touch-min)",
                opacity: asking ? 0.5 : 1,
                backgroundColor: "var(--product-color-surface-white)",
                borderColor: "var(--review-accent-primary)",
                color: "var(--review-accent-primary)",
              }}
            >
              <span className="text-sm font-bold">文にする</span>
            </button>
          ) : null}

          {suggestion ? (
            <SuggestLine text={suggestion} onAdopt={onAdopt} onUndo={onUndo} canUndo={canUndo} />
          ) : null}
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
        </div>
      </div>

      {/* 逃げ道は**見えていて初めて逃げ道**。画面下に固定して、常に押せる状態にする */}
      <div
        className="sticky bottom-0 z-10 w-full px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]"
        style={{ backgroundColor: "var(--product-color-bg-primary)" }}
      >
        <button
          type="button"
          onClick={onNext}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{
            backgroundColor: "var(--review-accent-primary)",
            color: "var(--review-accent-on-primary)",
          }}
        >
          <span className="text-base font-bold">{hasBody ? "書けた" : "このまま進む"}</span>
        </button>
      </div>
    </div>
  );
}

/* ── S3 届け先を選ぶ（全員に完全同一） ─────────────────
   案I（洋輔さん承認済み）。**どちらが良いかを一切書かない。用途だけ書く。**
   並び順は★によらず固定（順序効果が「満足度による扱いの差」に当たりうるため）。

   ⚠ 文言は v3 のまま。より用途表記に寄せた案（承認項目 A-1）は
     docs/specs/survey-v4.md §4 S3 にあり、**天真さんの承認が出るまで変えない**。 */

function DestinationStep({ onChoose }: { onChoose: (d: Destination) => void }) {
  const cards: { id: Destination; title: string; note: string }[] = [
    { id: "google", title: "Googleでみんなに広める", note: "Googleマップに公開されます" },
    { id: "store", title: "お店の担当者に伝える", note: "お店の担当者が確認します" },
  ];
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        この感想の届け先を
        <br />
        選んでください
      </h1>
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

/* ── S4-A Googleへ ────────────────────────────────
   本文が空の人もここで止まらずに完走させる（Googleマップは★だけの投稿を許容している）。 */

function GoogleStep({
  body,
  copied,
  onChangeBody,
  onBack,
  onFinish,
}: {
  body: string;
  copied: boolean;
  onChangeBody: (v: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const hasBody = body.trim() !== "";
  return (
    <div className="review-slide-in flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-32)] pt-[var(--product-space-24)]">
      <h1 className="text-xl font-bold tracking-[0.2px]" style={{ color: "var(--product-color-text-primary)" }}>
        {hasBody ? "この文章で投稿します" : "Googleマップを開きます"}
      </h1>

      {hasBody ? (
        <textarea
          value={body}
          onChange={(e) => onChangeBody(e.target.value)}
          rows={6}
          className="w-full resize-none rounded-[var(--product-radius-md)] border-[1.5px] border-solid p-[var(--product-space-12)] text-[15px] leading-[1.9]"
          style={{
            backgroundColor: "var(--product-color-surface-white)",
            borderColor: "var(--product-color-border-default)",
            color: "var(--product-color-text-primary)",
          }}
        />
      ) : (
        <p className="text-sm font-medium leading-[1.9]" style={{ color: "var(--product-color-text-secondary)" }}>
          文章なしで、★だけの投稿もできます。
        </p>
      )}

      <p className="text-xs font-medium leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
        選んだタグはGoogleには送られません。お店にだけ届きます。
        {hasBody ? (
          <>
            <br />
            コピーした文章は、Googleの投稿画面で貼り付けられます。
          </>
        ) : null}
      </p>

      <div className="flex w-full flex-col gap-[var(--product-space-12)]">
        <button
          type="button"
          onClick={onFinish}
          className="flex h-[52px] w-full items-center justify-center rounded-[var(--product-radius-sm)] transition-transform duration-100 active:scale-[0.99]"
          style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
        >
          <span className="text-base font-bold">{hasBody ? "コピーしてGoogleを開く" : "Googleマップを開く"}</span>
        </button>
        {/* コピーされた確証がないまま遷移すると、最後の1手で落ちる */}
        {copied && hasBody ? (
          <p className="review-pop text-center text-sm font-bold" style={{ color: "var(--review-accent-primary)" }}>
            文章をコピーしました
          </p>
        ) : null}
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

/* ── S4-B お店へ ─────────────────────────────────
   店に何が届くのかを送信前に見せる。Google 側と同じ1タップで終わらせ、2つの出口の重さを揃える。 */

function StoreStep({
  ratingLabel,
  topics,
  body,
  onBack,
  onFinish,
}: {
  ratingLabel: string;
  topics: string[];
  body: string;
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
        {body.trim() ? <Field label="あなたの言葉">{body.trim()}</Field> : null}
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

/* ── S5 完了 ─────────────────────────────────────
   追加のタップを一切要求しない。再投稿・シェア・アンケート再開の導線も置かない。 */

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
          : "いただいた内容は、お店の担当者が確認します"}
      </p>
      <p className="text-center text-xs font-medium" style={{ color: "var(--product-color-text-muted)" }}>
        これは検証用のデモです。回答は保存されません
      </p>
    </div>
  );
}
