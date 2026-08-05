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
 * ⚠ まだ Supabase プロジェクトが無い（docs/handoff.md参照）ため、
 * 02/04画面の送信・03画面のAI下書き生成は API Route に繋がっていない。
 * ここではローカルの模擬処理（setTimeout）で画面遷移だけを確認できるようにしてある。
 * Supabase が用意でき次第、submitGoodFeedback / submitImproveSurvey / generateDraft を
 * fetch("/api/...") に置き換えること。
 *
 * ⚠ E-5（重複回答対策・ブラウザ側でやんわり抑止）はまだ実装していない。2026-08-05、
 * 天真の指示で開発中の動作確認を優先するため一旦外した（同じ店舗スラッグに何度でも
 * 回答できる状態）。実装の最終段階で `localStorage` に `goodloop:${store.slug}:answered`
 * を立てる形で戻すこと（docs/specs/rating-flow.md E-5参照）。
 */

type Step = "rating" | "good-feedback" | "draft" | "improve-survey" | "thanks";

type Store = {
  name: string;
  slug: string;
  googlePlaceId: string | null;
  googleMapsFallbackUrl: string | null;
};

function googleReviewUrl(store: Store): string | null {
  if (store.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${store.googlePlaceId}`;
  }
  return store.googleMapsFallbackUrl;
}

// B節 案3（テンプレート合成）の簡易版。実際のAI生成（案1・Claude Haiku 4.5）はAPI Route側で行う。
function composeFallbackDraft(rating: 4 | 5, tags: string[], freeText: string): string {
  const tagPhrase = tags.length > 0 ? `${tags.join("や")}がとても良かったです。` : "";
  const feeling = rating === 5 ? "また利用したいと思います。" : "満足できました。";
  const trimmedFreeText = freeText.trim();
  const freeTextSentence = trimmedFreeText && !/[。！？]$/.test(trimmedFreeText) ? `${trimmedFreeText}。` : trimmedFreeText;
  return [tagPhrase, freeTextSentence, feeling].filter(Boolean).join("");
}

export function RatingFlow({ store }: { store: Store }) {
  const [step, setStep] = useState<Step>("rating");
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  const [goodTags, setGoodTags] = useState<string[]>([]);
  const [goodFreeText, setGoodFreeText] = useState("");
  const [submittingGood, setSubmittingGood] = useState(false);

  const [improveChecked, setImproveChecked] = useState<string[]>([]);
  const [improveFreeText, setImproveFreeText] = useState("");
  const [submittingImprove, setSubmittingImprove] = useState(false);

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

  function generateDraft(currentRating: 4 | 5, tags: string[], freeText: string) {
    setDraftStatus("generating");
    // TODO: Supabase/APIキーが揃ったら fetch("/api/rating-flow/generate-draft") に置き換える
    setTimeout(() => {
      setDraftText(composeFallbackDraft(currentRating, tags, freeText));
      setDraftStatus("fallback");
    }, 1200);
  }

  function handleGoodFeedbackSubmit() {
    setSubmittingGood(true);
    // TODO: fetch("/api/rating-flow/responses") に置き換える
    setTimeout(() => {
      setSubmittingGood(false);
      setStep("draft");
      generateDraft(rating as 4 | 5, goodTags, goodFreeText);
    }, 600);
  }

  function handleRegenerate() {
    if (regenerateCount >= REGENERATE_LIMIT) return;
    setRegenerating(true);
    setDraftStatus("generating");
    setTimeout(() => {
      setDraftText(composeFallbackDraft(rating as 4 | 5, goodTags, goodFreeText));
      setDraftStatus("fallback");
      setRegenerating(false);
      setRegenerateCount((c) => c + 1);
      setCopied(false);
    }, 1200);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
    } catch {
      // iOS Safari 等でクリップボードAPIが使えない場合は、コピー済み扱いにはしない
    }
  }

  function handleImproveSubmit() {
    setSubmittingImprove(true);
    // TODO: fetch("/api/rating-flow/responses") に置き換える
    setTimeout(() => {
      setSubmittingImprove(false);
      setStep("thanks");
    }, 600);
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
          selectedTags={goodTags}
          onToggleTag={(tag) => setGoodTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
          freeText={goodFreeText}
          onFreeTextChange={setGoodFreeText}
          submitting={submittingGood}
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
            if (url) window.open(url, "_blank", "noreferrer");
          }}
        />
      );
    case "improve-survey":
      return (
        <ImproveSurvey
          storeName={store.name}
          checked={improveChecked}
          onToggle={(item) => setImproveChecked((prev) => (prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]))}
          freeText={improveFreeText}
          onFreeTextChange={setImproveFreeText}
          submitting={submittingImprove}
          onSubmit={handleImproveSubmit}
        />
      );
    case "thanks":
      return <Thanks googleReviewUrl={googleReviewUrl(store)} />;
  }
}
