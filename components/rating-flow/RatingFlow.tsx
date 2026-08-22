"use client";

import { useState } from "react";
import { RatingTop } from "./screens/RatingTop";
import { GoodFeedback } from "./screens/GoodFeedback";
import { DraftResult, REGENERATE_LIMIT, type DraftStatus } from "./screens/DraftResult";
import { ImproveSurvey } from "./screens/ImproveSurvey";
import { Thanks } from "./screens/Thanks";

/**
 * お客様側フロー（docs/specs/rating-flow.md）のクライアント側オーケストレーター。
 *
 * A-5「画面間の遷移は別URLに遷移させずクライアント側の状態遷移で行う」の実装。
 * ★4以上→02→03、★1〜3→04→06 の分岐は A-2 で固定値と決定済み。
 *
 * 02/04画面の送信は POST /api/rating-flow/responses、03画面の再生成は
 * POST /api/rating-flow/regenerate-draft に接続済み（2026-08-06）。
 * ★4以上の初回下書きは responses のレスポンスに同梱される（A-1「同時に」に対応）。
 *
 * E-5（重複回答対策・ブラウザ側でやんわり抑止）は2026-08-18に天真の指示で解除した。
 * 同じ端末から何度でも回答できる。画面（screens/AlreadyAnswered.tsx）は再開に備えて残してある。
 */

type Step = "rating" | "good-feedback" | "draft" | "improve-survey" | "thanks";

type Store = {
  id: string;
  name: string;
  slug: string;
  googlePlaceId: string | null;
  googleMapsFallbackUrl: string | null;
};

type Tags = { good: string[]; improve: string[] };

const SUBMIT_ERROR_MESSAGE = "送信できませんでした。もう一度お試しください。";

function googleReviewUrl(store: Store): string | null {
  if (store.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${store.googlePlaceId}`;
  }
  return store.googleMapsFallbackUrl;
}

/** 送客数の元データ（launch-plan.md C節）。送りっぱなしで、失敗しても画面には出さない */
function trackEvent(responseId: string, eventType: "copied_draft" | "opened_google") {
  fetch("/api/rating-flow/track-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responseId, eventType }),
  }).catch(() => {});
}

export function RatingFlow({ store, tags }: { store: Store; tags: Tags }) {
  const [step, setStep] = useState<Step>("rating");
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const [goodTags, setGoodTags] = useState<string[]>([]);
  const [goodFreeText, setGoodFreeText] = useState("");
  const [submittingGood, setSubmittingGood] = useState(false);
  const [goodError, setGoodError] = useState<string | undefined>();

  const [improveChecked, setImproveChecked] = useState<string[]>([]);
  const [improveFreeText, setImproveFreeText] = useState("");
  const [submittingImprove, setSubmittingImprove] = useState(false);
  const [improveError, setImproveError] = useState<string | undefined>();

  const [responseId, setResponseId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("generating");
  const [draftText, setDraftText] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [copied, setCopied] = useState(false);

  function handleRatingSubmit() {
    // 「回答する」は星が未選択の間 disabled のため、ここに来る時点で rating は必ず入っている
    if (rating === null) return;
    setStep(rating >= 4 ? "good-feedback" : "improve-survey");
  }

  async function handleGoodFeedbackSubmit() {
    setSubmittingGood(true);
    setGoodError(undefined);
    try {
      const res = await fetch("/api/rating-flow/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, rating, branch: "good", tags: goodTags, freeText: goodFreeText }),
      });
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      const data: { responseId: string; draft: { text: string; status: DraftStatus } } = await res.json();
      setResponseId(data.responseId);
      setDraftText(data.draft.text);
      setDraftStatus(data.draft.status);
      setSubmittingGood(false);
      setStep("draft");
    } catch {
      setSubmittingGood(false);
      setGoodError(SUBMIT_ERROR_MESSAGE);
    }
  }

  async function handleRegenerate() {
    if (regenerateCount >= REGENERATE_LIMIT || responseId === null) return;
    setRegenerating(true);
    setDraftStatus("generating");
    try {
      const res = await fetch("/api/rating-flow/regenerate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId, rating, tags: goodTags, freeText: goodFreeText, regenerateCount }),
      });
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      const data: { draft: { text: string; status: DraftStatus } } = await res.json();
      setDraftText(data.draft.text);
      setDraftStatus(data.draft.status);
      setRegenerateCount((c) => c + 1);
      setCopied(false);
    } catch {
      // 再生成の失敗は下書きカードの表示を直前の状態に戻すだけでよい（送信済みの回答は失われない）
      setDraftStatus((prev) => (prev === "generating" ? "fallback" : prev));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      if (responseId) trackEvent(responseId, "copied_draft");
    } catch {
      // iOS Safari 等でクリップボードAPIが使えない場合は、コピー済み扱いにはしない
    }
  }

  async function handleImproveSubmit() {
    setSubmittingImprove(true);
    setImproveError(undefined);
    try {
      const res = await fetch("/api/rating-flow/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, rating, branch: "improve", tags: improveChecked, freeText: improveFreeText }),
      });
      if (!res.ok) throw new Error(`unexpected status ${res.status}`);
      setSubmittingImprove(false);
      setStep("thanks");
    } catch {
      setSubmittingImprove(false);
      setImproveError(SUBMIT_ERROR_MESSAGE);
    }
  }

  switch (step) {
    case "rating":
      return (
        <RatingTop storeName={store.name} rating={rating} onSelect={setRating} onSubmit={handleRatingSubmit} />
      );
    case "good-feedback":
      return (
        <GoodFeedback
          storeName={store.name}
          tags={tags.good}
          selectedTags={goodTags}
          onToggleTag={(tag) => setGoodTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
          freeText={goodFreeText}
          onFreeTextChange={setGoodFreeText}
          submitting={submittingGood}
          error={goodError}
          onSubmit={handleGoodFeedbackSubmit}
        />
      );
    case "draft":
      return (
        <DraftResult
          status={draftStatus}
          draftText={draftText}
          onDraftTextChange={setDraftText}
          regenerating={regenerating}
          regenerateCount={regenerateCount}
          onRegenerate={handleRegenerate}
          copied={copied}
          onCopy={handleCopy}
          onOpenGoogle={() => {
            const url = googleReviewUrl(store);
            if (!url) return;
            if (responseId) trackEvent(responseId, "opened_google");
            window.open(url, "_blank", "noreferrer");
          }}
        />
      );
    case "improve-survey":
      return (
        <ImproveSurvey
          storeName={store.name}
          items={tags.improve}
          checked={improveChecked}
          onToggle={(item) => setImproveChecked((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]))}
          freeText={improveFreeText}
          onFreeTextChange={setImproveFreeText}
          submitting={submittingImprove}
          error={improveError}
          onSubmit={handleImproveSubmit}
        />
      );
    case "thanks":
      return <Thanks googleReviewUrl={googleReviewUrl(store)} />;
  }
}
