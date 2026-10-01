"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AiBadge } from "@/components/rating-flow/AiBadge";
import { CopyIcon } from "@/components/rating-flow/icons";
import { BackIcon, CheckCircleIcon, CheckMarkIcon, MapPinIcon, MicIcon } from "@/components/demo/icons";
import { markInsertions, withPeriod, type MarkedChar } from "@/lib/survey/insertions";
import { OTHER_FIELD, v5Topic, type V5Topic } from "@/lib/survey/v5-topics";

/**
 * アンケート v5（docs/specs/survey-v5.md）。本番の `/r/[storeSlug]` と、検証用の `/demo/v5` の両方で使う。
 *
 * 見た目と動きは components/survey/v5.css（Webサイトのリブランディング版の世界観を借りている）。
 *
 * 流れ：① ★評価 → ② 印象に残ったこと（2カラム）→ ③ 届け先（2枚の扉）→ ④ ★だけ／書く／お店へ → 完了
 * 書く画面は「選んだ話題の欄＋その他（自由記入）」。**AIは欄の下の「完成した文章」で、各欄の言葉をつなげるだけ**
 * （助詞と句読点だけを足し、足した文字に色を付ける）。書いている途中にAIが話しかけることはない。
 *
 * **★で行き先を分けない。** ★はどの分岐にも使わず、届け先は本人が③で選ぶ（案I）。
 *
 * 保存（2026-10-01 本番化）：
 *   - Google … 画面は**先に Google を開き**、保存は待たない（ポップアップを止められないよう、押した瞬間に開く）。
 *              保存は keepalive で送るので、画面を離れても届く
 *   - お店   … 保存できたのを見てから完了へ進む。失敗したら、その場でもう一度押せる
 *   - `demo` のときは何も保存しない（/demo/v5）
 */

type Phase = "rating" | "topics" | "destination" | "starOnly" | "write" | "storeConfirm" | "done";
type Destination = "google" | "store";
type Level = 1 | 2 | 3 | 4 | 5;

/** 画面に出す店の情報。ロゴが無い店は店名を文字で出す */
export type V5Store = {
  /** 本番の店舗 id。demo のときは null */
  id: string | null;
  name: string;
  logoUrl: string | null;
  /** Google マップのクチコミ投稿を開く URL（lib/survey/google-url.ts）。demo のときは null */
  googleReviewUrl: string | null;
};

type SaveInput = {
  destination: Destination;
  wrote: boolean;
  copied?: boolean;
  openedGoogle?: boolean;
};

const LEVELS: Level[] = [1, 2, 3, 4, 5];
/** 本番の評価ボタン（components/rating-flow/RatingButton.tsx）と同じ言葉 */
const LEVEL_LABEL: Record<Level, string> = { 1: "不満", 2: "やや不満", 3: "ふつう", 4: "満足", 5: "とても満足" };
const TOTAL_STEPS = 4;
const STEP_OF: Record<Phase, number> = { rating: 1, topics: 2, destination: 3, starOnly: 4, write: 4, storeConfirm: 4, done: 4 };
/** 手が止まってから、AIにつなげてもらうまでの時間 */
const JOIN_IDLE_MS = 1200;
/** これより短い欄はAIに渡さない（本人の言葉のまま句点だけ足す） */
const JOIN_MIN_CHARS = 4;

/** 店のロゴ・店名を画面の奥の部品まで配る（どの段にも出るので、props で順に渡さない） */
const StoreContext = createContext<V5Store>({ id: null, name: "", logoUrl: null, googleReviewUrl: null });

/** 短い触覚。対応していない端末では何も起きない */
function tick() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
}

/** 1つの欄を整えた結果。AIの出力が検査を通らなかった欄は、本人の言葉のまま（色なし） */
type JoinedPart = { chars: MarkedChar[]; byAi: boolean };

function plainPart(text: string): JoinedPart {
  return { chars: Array.from(withPeriod(text)).map((char) => ({ char, inserted: false })), byAi: false };
}

export function V5Survey({ store, topics: topicChoices, demo = false }: { store: V5Store; topics: V5Topic[]; demo?: boolean }) {
  const [phase, setPhase] = useState<Phase>("rating");
  const [rating, setRating] = useState<Level | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>("google");
  const [fragments, setFragments] = useState<Record<string, string>>({});
  const [composing, setComposing] = useState(false);
  /** 問いのローテーション。同じ店で同じ問いが並ばないようにする */
  const [rotation, setRotation] = useState(0);

  // ── つなげる：欄の文字列ごとにAIの結果を覚えておき、変わった欄だけを頼み直す ──
  const cache = useRef(new Map<string, JoinedPart | "pending">());
  const [, setCacheVersion] = useState(0);
  const [useAi, setUseAi] = useState(true);
  const [edited, setEdited] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  // ── 保存：届け先ごとに1回だけ（同じ人が「コピー」と「開く」を押しても行が2つにならない） ──
  const saved = useRef<Partial<Record<Destination, Promise<string | null>>>>({});
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  // hydration のずれを避けるため、乱数はマウント後に決める
  useEffect(() => {
    setRotation(Math.floor(Math.random() * 3));
  }, []);

  /** 欄は「選んだ話題（選んだ順）＋その他」 */
  const fieldIds = [...topics, OTHER_FIELD.id];
  const filled = fieldIds.map((id) => (fragments[id] ?? "").trim()).filter((t) => t !== "");
  const filledKey = filled.join("\u0000");

  useEffect(() => {
    if (phase !== "write" || composing) return;
    const timer = window.setTimeout(() => {
      const todo = filledKey
        .split("\u0000")
        .filter((t) => t !== "" && !cache.current.has(t));
      if (todo.length === 0) return;
      for (const t of todo) cache.current.set(t, Array.from(t).length < JOIN_MIN_CHARS ? plainPart(t) : "pending");
      setCacheVersion((v) => v + 1);
      for (const text of todo) {
        if (cache.current.get(text) !== "pending") continue;
        // 渡すのは**その欄の文字列だけ**。★・話題・店名は渡さない（v4 の /api/survey/polish と検査をそのまま使う）
        fetch("/api/survey/polish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: text }),
        })
          .then((res) => res.json() as Promise<{ text?: string | null }>)
          .then((data) => {
            cache.current.set(
              text,
              data.text ? { chars: markInsertions(text, withPeriod(data.text)), byAi: true } : plainPart(text),
            );
          })
          .catch(() => cache.current.set(text, plainPart(text)))
          .finally(() => setCacheVersion((v) => v + 1));
      }
    }, JOIN_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, composing, filledKey]);

  const parts = filled.map((t) => {
    const hit = cache.current.get(t);
    return hit && hit !== "pending" ? hit : null;
  });
  const joining = parts.some((p) => p === null);
  const aiReady = !joining && parts.some((p) => p?.byAi);
  const plainText = filled.map(withPeriod).join("");
  const aiText = aiReady ? parts.map((p) => p!.chars.map((c) => c.char).join("")).join("") : null;
  const finalText = edited ?? (useAi && aiText ? aiText : plainText);
  /** 完成した文章に「AIがつなげた文」を使っているか（元の言葉のまま・直したときは false） */
  const aiJoined = edited === null && useAi && aiText !== null;

  /** 回答を保存する。届け先ごとに1回。保存できなければ null（お店のときは押し直せる） */
  const save = (input: SaveInput): Promise<string | null> => {
    if (demo || !store.id || rating === null) return Promise.resolve(demo ? "demo" : null);
    const existing = saved.current[input.destination];
    if (existing) return existing;
    const wrote = input.wrote && filled.length > 0;
    const fields: Record<string, string> = {};
    if (wrote) {
      for (const id of fieldIds) {
        const text = (fragments[id] ?? "").trim();
        if (text !== "") fields[id] = text;
      }
    }
    const request = fetch("/api/survey/v5/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Google のときは押した瞬間に Google を開くので、このページが裏に回っても届くようにする
      keepalive: true,
      body: JSON.stringify({
        storeId: store.id,
        rating,
        destination: input.destination,
        wrote,
        topics,
        fields: wrote ? fields : undefined,
        finalText: wrote ? finalText : undefined,
        aiJoined: wrote ? aiJoined : undefined,
        copied: input.copied === true,
        openedGoogle: input.openedGoogle === true,
      }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<{ responseId?: string }>) : null))
      .then((data) => data?.responseId ?? null)
      .catch(() => null);
    saved.current[input.destination] = request;
    // 保存できなかったら覚えておかない（押し直したときに、もう一度送れるように）
    request.then((id) => {
      if (id === null) delete saved.current[input.destination];
    });
    return request;
  };

  /** すでに保存した回答に、Google を開いたことを書き足す（コピー → 開く の順に進んだ人） */
  const trackOpened = (request: Promise<string | null>) => {
    if (demo) return;
    request.then((responseId) => {
      if (!responseId) return;
      fetch("/api/rating-flow/track-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ responseId, eventType: "opened_google" }),
      }).catch(() => {});
    });
  };

  /** Google を開いて完了へ。**開くのは押した瞬間**（保存を待つとポップアップが止められる） */
  const openGoogle = (wrote: boolean) => {
    tick();
    if (!demo && store.googleReviewUrl) window.open(store.googleReviewUrl, "_blank", "noreferrer");
    const existing = saved.current.google;
    if (existing) trackOpened(existing);
    else void save({ destination: "google", wrote, openedGoogle: true });
    setPhase("done");
    window.scrollTo({ top: 0 });
  };

  /** お店へ届ける。保存できたのを見てから完了へ進む */
  const sendToStore = async (wrote: boolean) => {
    tick();
    setSending(true);
    setSendFailed(false);
    const responseId = await save({ destination: "store", wrote });
    setSending(false);
    if (responseId === null) {
      setSendFailed(true);
      return;
    }
    setPhase("done");
    window.scrollTo({ top: 0 });
  };

  const chooseRating = (level: Level) => {
    tick();
    setRating(level);
    // ★が弾んで輪が広がるのを見てから進む
    window.setTimeout(() => setPhase("topics"), 700);
  };

  const toggleTopic = (id: string) => {
    tick();
    setTopics((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const go = (next: Phase) => {
    tick();
    setSendFailed(false);
    setPhase(next);
    window.scrollTo({ top: 0 });
  };

  const copy = async () => {
    tick();
    try {
      await navigator.clipboard.writeText(finalText);
      setCopiedText(finalText);
      setCopyFailed(false);
      // コピーできた時点で保存する（このあと Google の画面へ行ったきり戻らない人がいるため）
      void save({ destination: "google", wrote: true, copied: true });
    } catch {
      // コピーできていないのに「コピーしました」と出すと、貼り付ける段で必ず詰まる（v4 のレビュー）。
      // ただ、アプリ内ブラウザなどコピーを許さない環境で先へ進めなくなるのはもっと悪いので、
      // 長押しでのコピーを案内し、②のボタンは押せるようにする
      setCopiedText(null);
      setCopyFailed(true);
    }
  };

  return (
    <StoreContext.Provider value={store}>
      <div className="v5 mx-auto flex min-h-dvh w-full max-w-[390px] flex-col">
        {phase === "rating" ? <RatingStep selected={rating} onSelect={chooseRating} /> : null}

        {phase !== "rating" && phase !== "done" ? (
          <AppBar step={STEP_OF[phase]} onBack={() => go(phase === "topics" ? "rating" : phase === "destination" ? "topics" : "destination")} />
        ) : null}

        {phase === "topics" ? (
          <TopicsStep rating={rating} choices={topicChoices} topics={topics} onToggle={toggleTopic} onNext={() => go("destination")} />
        ) : null}

        {phase === "destination" ? (
          <DestinationStep
            onWrite={(d) => {
              setDestination(d);
              go("write");
            }}
            onStarOnly={() => {
              setDestination("google");
              go("starOnly");
            }}
            onStoreRatingOnly={() => {
              setDestination("store");
              go("storeConfirm");
            }}
          />
        ) : null}

        {phase === "starOnly" ? <StarOnlyStep rating={rating} onOpenGoogle={() => openGoogle(false)} /> : null}

        {phase === "storeConfirm" ? (
          <StoreConfirmStep rating={rating} topics={topics} sending={sending} failed={sendFailed} onSend={() => void sendToStore(false)} />
        ) : null}

        {phase === "write" ? (
          <WriteStep
            destination={destination}
            rating={rating}
            fieldIds={fieldIds}
            fragments={fragments}
            rotation={rotation}
            onChange={(id, v) => setFragments((prev) => ({ ...prev, [id]: v }))}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            hasText={filled.length > 0}
            joining={joining}
            aiParts={aiReady && useAi && edited === null ? (parts as JoinedPart[]) : null}
            aiReady={aiReady}
            useAi={useAi}
            onToggleAi={() => {
              tick();
              setUseAi((v) => !v);
            }}
            edited={edited}
            onEdit={setEdited}
            finalText={finalText}
            copied={copiedText !== null && copiedText === finalText}
            copyFailed={copyFailed}
            onCopy={copy}
            onOpenGoogle={() => openGoogle(filled.length > 0)}
            sending={sending}
            sendFailed={sendFailed}
            onSendToStore={() => void sendToStore(filled.length > 0)}
          />
        ) : null}

        {phase === "done" ? <DoneStep destination={destination} demo={demo} /> : null}
      </div>
    </StoreContext.Provider>
  );
}

/* ── 共通：店のロゴ・進み具合・上のバー ─────────────────────────── */

/**
 * 店のロゴ（Figma `Logo / Horizontal / Black` 49:870 の位置）。
 * 店舗にロゴの画像があればそれを、無ければ**店名を文字で**出す（多くの店はロゴを登録していないため。2026-10-01）。
 */
function StoreLogo({ height }: { height: number }) {
  const store = useContext(StoreContext);
  if (store.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 店舗ごとの画像（Supabase Storage）。next/image は配信元の許可設定が要るので使わない
      <img src={store.logoUrl} alt={store.name} className="w-auto max-w-[240px] object-contain" style={{ height }} />
    );
  }
  return (
    <p
      className="max-w-[260px] truncate text-center font-bold leading-none tracking-[0.02em]"
      style={{ fontSize: Math.round(height * 0.5), lineHeight: `${height}px` }}
    >
      {store.name}
    </p>
  );
}

/** 進み具合（Figma `Review / Progress Bar` を4段にしたもの） */
function Progress({ step }: { step: number }) {
  return (
    <div className="flex w-full gap-[var(--product-space-4)]" aria-label={`${TOTAL_STEPS}つのうち${step}つ目`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-[var(--product-radius-full)]"
          style={{
            backgroundColor: i < step ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
            transition: "background-color 500ms var(--v5-ease-out)",
          }}
        />
      ))}
    </div>
  );
}

/** アプリの上のバー：左上に「もどる」、真ん中に店のロゴ、下に進み具合（2026-09-28 天真） */
function AppBar({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-16)] pb-[var(--product-space-12)] pt-[var(--product-space-8)]"
      style={{ backgroundColor: "var(--v5-paper)" }}
    >
      <div className="grid w-full grid-cols-[44px_1fr_44px] items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="もどる"
          className="v5-press flex size-11 items-center justify-center rounded-[var(--product-radius-full)]"
          style={{ color: "var(--v5-ink)" }}
        >
          <BackIcon className="size-5" />
        </button>
        <div className="flex justify-center">
          <StoreLogo height={30} />
        </div>
        <span aria-hidden />
      </div>
      <Progress step={step} />
    </div>
  );
}

function RuleLabel({ children }: { children: React.ReactNode }) {
  return <p className="v5-rule-label">{children}</p>;
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 flex w-full flex-col gap-[var(--product-space-8)] px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-12)]"
      style={{ backgroundColor: "var(--v5-paper)" }}
    >
      {children}
    </div>
  );
}

/* ── ★ ───────────────────────────────────────────────
   Webサイトの★と同じ：塗りは黄に墨の線、空きは白に薄い線。 */

function StarIcon({ filled, className, style }: { filled: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.8l2.83 5.9 6.47.78-4.76 4.46 1.22 6.4L12 17.2l-5.76 3.14 1.22-6.4-4.76-4.46 6.47-.78L12 2.8z"
        style={{
          fill: filled ? "var(--v5-star)" : "var(--product-color-surface-white)",
          stroke: filled ? "var(--v5-ink)" : "var(--product-color-text-muted)",
        }}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarsInline({ level }: { level: Level }) {
  return (
    <span className="inline-flex items-center gap-[var(--product-space-2)]" aria-label={`★${level}`}>
      {LEVELS.map((n) => (
        <StarIcon key={n} filled={n <= level} className="size-4" />
      ))}
    </span>
  );
}

function RatingReminder({ rating }: { rating: Level }) {
  return (
    <div
      className="flex w-full items-center justify-between rounded-[var(--product-radius-md)] px-[var(--product-space-16)] py-[var(--product-space-12)]"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <p className="text-sm" style={{ color: "var(--product-color-text-secondary)" }}>
        あなたの評価
      </p>
      <p className="flex items-center gap-[var(--product-space-8)] text-sm font-bold">
        <StarsInline level={rating} />
        {LEVEL_LABEL[rating]}
      </p>
    </div>
  );
}

/* ── ① 評価 ───────────────────────────────────────────
   Figma `01 Rating UI Exploration` の Pattern C（星タップ・Google型）。Googleと同じ操作で、★の記憶のまま Google へ。
   タップすると黄色い輪が広がり、★が左から順に弾む（Webサイトの tap と同じ動き）。 */

function RatingStep({ selected, onSelect }: { selected: Level | null; onSelect: (level: Level) => void }) {
  const [ring, setRing] = useState<{ level: Level; key: number } | null>(null);
  return (
    <div className="flex w-full flex-1 flex-col items-center px-[var(--product-space-24)] pb-[var(--product-space-40)] pt-[var(--product-space-24)]">
      <Progress step={1} />
      <div className="v5-rise mt-[var(--product-space-48)]">
        <StoreLogo height={47} />
      </div>

      <div className="mt-[var(--product-space-64)] flex w-full flex-col items-center gap-[var(--product-space-12)] text-center">
        <p
          className="v5-rise rounded-[var(--product-radius-full)] px-[var(--product-space-16)] py-[var(--product-space-4)] text-xs font-bold"
          style={{ backgroundColor: "var(--review-accent-wash)", animationDelay: "80ms" }}
        >
          所要時間は約1分です
        </p>
        <h1 className="v5-rise text-[22px] font-bold leading-[1.4] tracking-[0.02em]" style={{ animationDelay: "140ms" }}>
          本日の体験はいかがでしたか？
        </h1>
        <p className="v5-rise text-sm" style={{ color: "var(--product-color-text-secondary)", animationDelay: "200ms" }}>
          星をタップして評価してください
        </p>
      </div>

      <div
        className="v5-land mt-[var(--product-space-32)] flex w-full flex-col gap-[var(--product-space-12)] rounded-[20px] border-2 border-solid px-[var(--product-space-12)] pb-[var(--product-space-16)] pt-[var(--product-space-20)]"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--v5-ink)", animationDelay: "260ms" }}
      >
        <div role="radiogroup" aria-label="5段階の評価" className="flex w-full justify-between">
          {LEVELS.map((n) => {
            const filled = selected !== null && n <= selected;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected === n}
                aria-label={`★${n}（${LEVEL_LABEL[n]}）`}
                onClick={() => {
                  setRing({ level: n, key: Date.now() });
                  onSelect(n);
                }}
                className="v5-press relative flex size-14 items-center justify-center"
              >
                {ring && ring.level === n ? (
                  <span key={ring.key} aria-hidden>
                    <span className="v5-ring" />
                    <span className="v5-ring v5-ring--inner" />
                  </span>
                ) : null}
                <StarIcon
                  key={`${n}-${filled ? ring?.key ?? "f" : "e"}`}
                  filled={filled}
                  className={`size-11 ${filled && ring ? "v5-star-pop" : ""}`}
                  style={{ animationDelay: `${(n - 1) * 70}ms` }}
                />
              </button>
            );
          })}
        </div>
        <div className="flex w-full justify-between px-[var(--product-space-8)] text-[11px]" style={{ color: "var(--product-color-text-tertiary)" }}>
          <span>不満</span>
          <span>とても満足</span>
        </div>
      </div>

      <p className="mt-[var(--product-space-20)] h-6 text-base font-bold" aria-live="polite">
        {selected ? (
          <span key={selected} className="v5-stamp">
            {LEVEL_LABEL[selected]}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/* ── ② 印象に残ったこと ─────────────────────────────────────
   Figma `02 / 良かった点`（1:360）の2カラム。問いは「良かった点」（選別に見える）でも「悪かった点」（わざわざ聞かない）
   でもなく、良くも悪くも言える「印象に残ったこと」にした（2026-09-28 天真の依頼で見直し）。
   ここで選んだ数だけ、書く画面の欄ができる。 */

function TopicsStep({
  rating,
  choices,
  topics,
  onToggle,
  onNext,
}: {
  rating: Level | null;
  /** 店舗の業態に合わせた6つ（lib/survey/v5-topics.ts の v5TopicsFor） */
  choices: V5Topic[];
  topics: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-24)] pt-[var(--product-space-12)]">
        <div className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]">
          <RuleLabel>ご回答ありがとうございます</RuleLabel>
          <h1 className="text-[22px] font-bold leading-[1.4]">印象に残ったことはありますか？</h1>
          <p className="text-sm leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
            いくつでも選べます。選ばなくても次へ進めます。
          </p>
          {rating ? (
            <p className="flex items-center gap-[var(--product-space-8)] text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
              今日の評価 <StarsInline level={rating} />
            </p>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-2 gap-[var(--product-space-12)]">
          {choices.map((topic, i) => {
            const on = topics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(topic.id)}
                className={`v5-press v5-rise flex min-h-14 items-center justify-center gap-[var(--product-space-8)] rounded-[14px] border-solid px-[var(--product-space-12)] ${on ? "v5-bump" : ""}`}
                style={{
                  animationDelay: `${120 + i * 50}ms`,
                  backgroundColor: on ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                  borderWidth: on ? 2 : 1.5,
                  borderColor: on ? "var(--v5-ink)" : "var(--product-color-border-default)",
                }}
              >
                {on ? (
                  <span className="v5-stamp" style={{ color: "var(--review-accent-action)" }}>
                    <CheckMarkIcon className="size-4" />
                  </span>
                ) : null}
                <span className="text-sm font-bold">{topic.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <StickyBar>
        <button type="button" onClick={onNext} className="v5-press v5-btn v5-btn--primary">
          次へ
        </button>
      </StickyBar>
    </div>
  );
}

/* ── ③ 届け先（2枚の扉） ──────────────────────────────────────
   2枚は同じ大きさ・同じ形・同じ書式（案I・LP「2つの扉は同じ重さ」）。並び順は★によらず固定。
   イラストは Figma `05 / 宛先を選ぶ`（732:12673）の Google とお店。上が塗りの「文章も書く」、下が枠の「★だけ」。 */

function DestinationStep({
  onWrite,
  onStarOnly,
  onStoreRatingOnly,
}: {
  onWrite: (d: Destination) => void;
  onStarOnly: () => void;
  onStoreRatingOnly: () => void;
}) {
  return (
    <div className="flex w-full flex-1 flex-col gap-[var(--product-space-24)] px-[var(--product-space-20)] pb-[var(--product-space-40)] pt-[var(--product-space-12)]">
      <div className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]">
        <RuleLabel>届け先</RuleLabel>
        <h1 className="text-[22px] font-bold leading-[1.4]">この感想を、どこに届けますか？</h1>
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-24)]">
        <DoorCard
          art="google"
          title="Googleマップに投稿"
          note="だれでも読めます"
          quietLabel="★だけで評価する"
          onWrite={() => onWrite("google")}
          onQuiet={onStarOnly}
          delay={80}
        />
        <DoorCard
          art="store"
          title="お店にだけ届ける"
          note="お店の人だけが読みます"
          quietLabel="★評価だけを届ける"
          onWrite={() => onWrite("store")}
          onQuiet={onStoreRatingOnly}
          delay={200}
        />
      </div>
      <p className="text-center text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
        どちらを選んでも、ご回答はお店に届いています
      </p>
    </div>
  );
}

/** Figma の画像の切り抜き位置をそのまま再現する（732:12681／732:12686） */
function DoorArt({ art }: { art: Destination }) {
  const crop =
    art === "google"
      ? { box: { width: 29, height: 36.754 }, img: { height: "108.02%", left: "-18.45%", top: "-4.01%", width: "136.9%" }, src: "/demo/v5/door-google.png" }
      : { box: { width: 40, height: 32 }, img: { height: "136.72%", left: "-31.88%", top: "-17.62%", width: "163.75%" }, src: "/demo/v5/door-store.png" };
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: crop.box.width * 1.3, height: crop.box.height * 1.3 }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma の書き出し。切り抜き位置を保つため img の絶対配置で置く */}
      <img alt="" src={crop.src} className="absolute max-w-none" style={crop.img} />
    </div>
  );
}

function DoorCard({
  art,
  title,
  note,
  quietLabel,
  onWrite,
  onQuiet,
  delay,
}: {
  art: Destination;
  title: string;
  note: string;
  quietLabel: string;
  onWrite: () => void;
  onQuiet: () => void;
  delay: number;
}) {
  return (
    <div
      className="v5-land v5-paper-card flex w-full flex-col items-center gap-[var(--product-space-16)] rounded-[20px] border-2 border-solid px-[var(--product-space-20)] pb-[var(--product-space-20)] pt-[var(--product-space-24)]"
      style={{ animationDelay: `${delay}ms`, backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--v5-ink)" }}
    >
      <DoorArt art={art} />
      <div className="flex w-full flex-col items-center gap-[var(--product-space-4)] text-center">
        <p className="text-[17px] font-bold">{title}</p>
        <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
          {note}
        </p>
      </div>
      <div className="flex w-full flex-col gap-[var(--product-space-8)]">
        <button type="button" onClick={onWrite} className="v5-press v5-btn v5-btn--primary">
          文章も書く
        </button>
        <button type="button" onClick={onQuiet} className="v5-press v5-btn v5-btn--secondary">
          {quietLabel}
        </button>
      </div>
    </div>
  );
}

/* ── ④a ★だけで評価する（Google） ─────────────────────────────── */

function StarOnlyStep({ rating, onOpenGoogle }: { rating: Level | null; onOpenGoogle: () => void }) {
  return (
    <div className="flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-40)] pt-[var(--product-space-12)]">
      <div className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]">
        <RuleLabel>Googleマップへ</RuleLabel>
        <h1 className="text-[22px] font-bold leading-[1.4]">Googleマップで★を付けます</h1>
      </div>
      {rating ? <RatingReminder rating={rating} /> : null}
      <p className="text-[15px] leading-[1.9]">Googleの画面で★を選んで、「投稿」を押すと完了です。</p>
      <p className="text-xs leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
        文章は書かなくても投稿できます。選んだものはGoogleには送られません。お店にだけ届きます。
      </p>
      <button type="button" onClick={onOpenGoogle} className="v5-press v5-btn v5-btn--primary">
        <MapPinIcon className="size-[17px] shrink-0" />
        Googleマップを開く
      </button>
    </div>
  );
}

/* ── ④c ★評価だけを届ける（お店） ────────────────────────────── */

function StoreConfirmStep({
  rating,
  topics,
  sending,
  failed,
  onSend,
}: {
  rating: Level | null;
  topics: string[];
  sending: boolean;
  failed: boolean;
  onSend: () => void;
}) {
  const labels = topics.map((id) => v5Topic(id)?.label ?? "").filter(Boolean);
  return (
    <div className="flex w-full flex-1 flex-col gap-[var(--product-space-20)] px-[var(--product-space-20)] pb-[var(--product-space-40)] pt-[var(--product-space-12)]">
      <div className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]">
        <RuleLabel>お店へ</RuleLabel>
        <h1 className="text-[22px] font-bold leading-[1.4]">お店にとどく内容</h1>
      </div>
      <div
        className="v5-land v5-paper-card flex w-full flex-col gap-[var(--product-space-16)] rounded-[20px] border-2 border-solid p-[var(--product-space-20)]"
        style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--v5-ink)" }}
      >
        {rating ? (
          <Field label="今日の評価">
            <span className="flex items-center gap-[var(--product-space-8)]">
              <StarsInline level={rating} />
              {LEVEL_LABEL[rating]}
            </span>
          </Field>
        ) : null}
        {labels.length > 0 ? <Field label="印象に残ったこと">{labels.join("／")}</Field> : null}
      </div>
      {failed ? <SendFailedNote /> : null}
      <button type="button" onClick={onSend} disabled={sending} className="v5-press v5-btn v5-btn--primary mt-[var(--product-space-8)]">
        {sending ? "送っています…" : "とどける"}
      </button>
    </div>
  );
}

/** お店へ届けられなかったとき。押し直せば、もう一度送る（保存できなかった回答は覚えていない） */
function SendFailedNote() {
  return (
    <p role="alert" className="text-sm leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
      送れませんでした。電波の良いところで、もう一度押してください。
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[var(--product-space-4)]">
      <p className="text-xs font-bold" style={{ color: "var(--product-color-text-tertiary)" }}>
        {label}
      </p>
      <div className="text-[15px] leading-[1.8]">{children}</div>
    </div>
  );
}

/* ── ④b 書く ─────────────────────────────────────────────
   欄は「選んだ話題（選んだ順）＋その他（自由記入）」。各欄は5行（2026-09-28 天真）。
   欄の下に**完成した文章**を常に出す：書くと手が止まってから約1秒で、AIが各欄に助詞と句読点だけを足して1つにつなげる。
   AIが足した文字には色を付ける。Googleのときは ①コピー ②Googleマップを開く ③貼り付けて投稿 の順に押せる。 */

function WriteStep({
  destination,
  rating,
  fieldIds,
  fragments,
  rotation,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  hasText,
  joining,
  aiParts,
  aiReady,
  useAi,
  onToggleAi,
  edited,
  onEdit,
  finalText,
  copied,
  copyFailed,
  onCopy,
  onOpenGoogle,
  sending,
  sendFailed,
  onSendToStore,
}: {
  destination: Destination;
  rating: Level | null;
  fieldIds: string[];
  fragments: Record<string, string>;
  rotation: number;
  onChange: (id: string, value: string) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
  hasText: boolean;
  joining: boolean;
  aiParts: JoinedPart[] | null;
  aiReady: boolean;
  useAi: boolean;
  onToggleAi: () => void;
  edited: string | null;
  onEdit: (value: string | null) => void;
  finalText: string;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
  /** ②Googleマップを開く／書かずにGoogleマップを開く */
  onOpenGoogle: () => void;
  sending: boolean;
  sendFailed: boolean;
  /** この文章をお店に届ける／書かずに届ける */
  onSendToStore: () => void;
}) {
  const google = destination === "google";
  /** ②を押せるのは、コピーできたとき（できなかったときは長押しを案内したうえで押せるようにする） */
  const canOpenGoogle = copied || copyFailed;
  const editing = edited !== null;

  return (
    <div className="flex w-full flex-1 flex-col gap-[var(--product-space-24)] px-[var(--product-space-20)] pb-[var(--product-space-48)] pt-[var(--product-space-12)]">
      <div className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]">
        <RuleLabel>{google ? "Googleマップに投稿" : "お店にだけ届ける"}</RuleLabel>
        <h1 className="text-[22px] font-bold leading-[1.4]">{google ? "Googleに載せる感想を書く" : "お店に届ける感想を書く"}</h1>
        <p className="text-sm leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
          選んだことごとに、思ったことを書いてください。単語だけでも大丈夫です。最後にAIが1つの文章につなげます。
        </p>
        <p className="flex items-center gap-[var(--product-space-4)] text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
          <MicIcon className="size-4 shrink-0" />
          キーボードのマイクで、話しても書けます
        </p>
      </div>

      {fieldIds.map((id, i) => {
        const topic = v5Topic(id);
        const label = topic ? topic.fieldLabel : OTHER_FIELD.fieldLabel;
        const questions = topic ? topic.questions : OTHER_FIELD.questions;
        return (
          <label key={id} className="v5-rise flex w-full flex-col gap-[var(--product-space-8)]" style={{ animationDelay: `${80 + i * 60}ms` }}>
            <span className="text-sm font-bold">{label}</span>
            {/* プレースホルダは**例文ではなく問い**。欄ごとに違う問いになる */}
            <textarea
              value={fragments[id] ?? ""}
              onChange={(e) => onChange(id, e.target.value)}
              onCompositionStart={onCompositionStart}
              onCompositionEnd={onCompositionEnd}
              rows={5}
              placeholder={questions[rotation % questions.length]}
              className="v5-notebook w-full resize-none rounded-[14px] border-[1.5px] border-solid px-[var(--product-space-12)] py-[var(--product-space-4)] text-[15px] outline-none focus:border-2 focus:border-[color:var(--product-color-text-primary)]"
              style={{ borderColor: "var(--product-color-border-default)" }}
            />
          </label>
        );
      })}

      <p className="text-xs leading-[1.9]" style={{ color: "var(--product-color-text-tertiary)" }}>
        空いている欄があっても大丈夫です。お名前など、個人が特定できることは書かないでください。
        {google ? "書いた文章は、お店にも届きます。" : ""}
      </p>

      {/* ── 完成した文章（AIがつなげたもの） ── */}
      <section className="flex w-full flex-col gap-[var(--product-space-12)]" aria-label="完成した文章">
        <div className="flex w-full items-center justify-between gap-[var(--product-space-8)]">
          <RuleLabel>完成した文章</RuleLabel>
          {aiParts ? <AiBadge label="AIがつなげました" /> : null}
        </div>

        {editing ? (
          <textarea
            value={edited ?? ""}
            onChange={(e) => onEdit(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-[20px] border-2 border-solid p-[var(--product-space-16)] text-[15px] leading-[1.9] outline-none"
            style={{ backgroundColor: "var(--product-color-surface-white)", borderColor: "var(--v5-ink)" }}
          />
        ) : (
          <div
            aria-busy={joining}
            className="v5-paper-card w-full rounded-[20px] border-2 p-[var(--product-space-16)] text-[15px] leading-[2]"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: hasText ? "var(--v5-ink)" : "var(--product-color-text-muted)",
              borderStyle: hasText ? "solid" : "dashed",
            }}
          >
            {!hasText ? (
              <span style={{ color: "var(--product-color-text-tertiary)" }}>上の欄に書くと、ここにAIがつないだ文章が出ます。</span>
            ) : aiParts ? (
              aiParts.map((part, k) => (
                <span key={k}>
                  {part.chars.map((c, i) =>
                    c.inserted ? (
                      <span
                        key={i}
                        className="v5-stamp rounded-[3px] px-[1px] font-bold"
                        style={{
                          backgroundColor: "var(--review-accent-wash)",
                          color: "var(--review-accent-action)",
                          animationDelay: `${Math.min(i, 12) * 30}ms`,
                        }}
                      >
                        {c.char}
                      </span>
                    ) : (
                      <span key={i}>{c.char}</span>
                    ),
                  )}
                </span>
              ))
            ) : (
              <span style={{ opacity: joining ? 0.55 : 1, transition: "opacity 250ms" }}>{finalText}</span>
            )}
          </div>
        )}

        {hasText ? (
          <>
            {aiParts ? (
              <p className="text-xs leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
                <span
                  className="mr-[var(--product-space-4)] rounded-[3px] px-[var(--product-space-4)] font-bold"
                  style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-action)" }}
                >
                  色の付いた文字
                </span>
                が、AIが足したところです。足したのは助詞と句読点だけで、中身はあなたの言葉のままです。
              </p>
            ) : null}
            {editing ? (
              <p className="text-xs leading-[1.8]" style={{ color: "var(--product-color-text-tertiary)" }}>
                直している間は、上の欄を書き換えてもここには反映されません。
              </p>
            ) : null}
            <div className="flex w-full flex-wrap gap-[var(--product-space-8)]">
              {aiReady && !editing ? (
                <SmallButton onClick={onToggleAi}>{useAi ? "元の言葉のまま使う" : "AIでつなげた文を使う"}</SmallButton>
              ) : null}
              {editing ? (
                <SmallButton onClick={() => onEdit(null)}>直すのをやめる</SmallButton>
              ) : (
                <SmallButton
                  onClick={() => {
                    tick();
                    onEdit(finalText);
                  }}
                >
                  直す
                </SmallButton>
              )}
            </div>
          </>
        ) : null}
      </section>

      {/* ── 送る ── */}
      {google ? (
        <section className="flex w-full flex-col gap-[var(--product-space-12)]" aria-label="Googleに投稿する手順">
          {rating ? <RatingReminder rating={rating} /> : null}
          {hasText ? (
            <>
              <StepRow n={1} state={copied ? "done" : "active"}>
                <button type="button" onClick={onCopy} disabled={joining} className={`v5-press v5-btn ${copied ? "v5-btn--done" : "v5-btn--primary"}`}>
                  {copied ? <CheckMarkIcon className="size-4" /> : <CopyIcon className="size-[17px] shrink-0" />}
                  {copied ? "コピーしました" : "この文章をコピー"}
                </button>
              </StepRow>
              {copyFailed && !copied ? (
                <p role="status" className="text-xs leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
                  自動でコピーできませんでした。上の「完成した文章」を長押しして、コピーしてください。
                </p>
              ) : null}
              <StepRow n={2} state={canOpenGoogle ? "active" : "idle"}>
                <button type="button" onClick={onOpenGoogle} disabled={!canOpenGoogle} className="v5-press v5-btn v5-btn--primary">
                  <MapPinIcon className="size-[17px] shrink-0" />
                  Googleマップを開く
                </button>
              </StepRow>
              <StepRow n={3} state="idle">
                <p className="text-sm leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
                  Googleの画面で★を選び、クチコミ欄に貼り付けて投稿
                </p>
              </StepRow>
            </>
          ) : (
            <button type="button" onClick={onOpenGoogle} className="v5-press v5-btn v5-btn--secondary">
              書かずにGoogleマップを開く
            </button>
          )}
        </section>
      ) : (
        <section className="flex w-full flex-col gap-[var(--product-space-12)]" aria-label="お店に届ける">
          {sendFailed ? <SendFailedNote /> : null}
          <button
            type="button"
            onClick={onSendToStore}
            disabled={(hasText && joining) || sending}
            className="v5-press v5-btn v5-btn--primary"
          >
            {sending ? "送っています…" : hasText ? "この文章をお店に届ける" : "書かずに届ける"}
          </button>
        </section>
      )}
    </div>
  );
}

/** Figma `03 / 下書き結果・コピー` の ①②③（Review / Step Number）。いま押すべき番号だけ濃くする */
function StepRow({ n, state, children }: { n: 1 | 2 | 3; state: "active" | "done" | "idle"; children: React.ReactNode }) {
  const bg = state === "active" ? "var(--v5-ink)" : state === "done" ? "var(--review-accent-primary)" : "var(--product-color-bg-tertiary)";
  const fg = state === "idle" ? "var(--product-color-text-tertiary)" : "var(--product-color-surface-white)";
  return (
    <div className="flex w-full items-center gap-[var(--product-space-12)]">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-[var(--product-radius-full)] text-xs font-bold"
        style={{ backgroundColor: bg, color: fg, transition: "background-color 250ms var(--v5-ease-out)" }}
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="v5-press rounded-[var(--product-radius-full)] border-[1.5px] border-solid px-[var(--product-space-16)] text-sm font-bold"
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

/* ── 完了 ───────────────────────────────────────────── */

function DoneStep({ destination, demo }: { destination: Destination; demo: boolean }) {
  const store = useContext(StoreContext);
  const message = useMemo(() => {
    if (destination === "store") return "いただいた内容は、お店の担当者が確認します";
    // 本番は②を押した瞬間に別のタブで Google を開いている。戻ってきた人がここを見る
    return demo ? "このあとGoogleマップの投稿画面が開きます" : "Googleマップの投稿画面を、別のタブで開きました";
  }, [destination, demo]);
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-[var(--product-space-20)] px-[var(--product-space-24)] py-[var(--product-space-40)]">
      <div className="v5-stamp">
        <CheckCircleIcon className="size-16 shrink-0" style={{ color: "var(--product-color-text-tertiary)" }} />
      </div>
      <StoreLogo height={36} />
      <p className="v5-rise text-center text-xl font-bold">ありがとうございました</p>
      <p className="v5-rise text-center text-sm leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
        {message}
      </p>
      {!demo && destination === "google" && store.googleReviewUrl ? (
        // 開かなかった（ブラウザに止められた・閉じてしまった）人のための入り口。押せる大きさにする
        <a
          href={store.googleReviewUrl}
          target="_blank"
          rel="noreferrer"
          className="v5-press v5-btn v5-btn--secondary"
          onClick={() => tick()}
        >
          <MapPinIcon className="size-[17px] shrink-0" />
          開かなかったときは、こちら
        </a>
      ) : null}
      {demo ? (
        <p className="text-center text-xs" style={{ color: "var(--product-color-text-muted)" }}>
          これは検証用のデモです。回答は保存されません
        </p>
      ) : null}
    </div>
  );
}
