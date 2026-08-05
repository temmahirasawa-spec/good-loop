/**
 * クチコミ下書きのフォールバック文面（docs/specs/rating-flow.md B節・案3）。
 * AI生成（案1）が失敗・タイムアウトしたときに使う。API Route（サーバー側）専用。
 */
export function composeFallbackDraft(rating: 4 | 5, tags: string[], freeText: string): string {
  const tagPhrase = tags.length > 0 ? `${tags.join("や")}がとても良かったです。` : "";
  const feeling = rating === 5 ? "また利用したいと思います。" : "満足できました。";
  const trimmedFreeText = freeText.trim();
  const freeTextSentence = trimmedFreeText && !/[。！？]$/.test(trimmedFreeText) ? `${trimmedFreeText}。` : trimmedFreeText;
  return [tagPhrase, freeTextSentence, feeling].filter(Boolean).join("");
}
