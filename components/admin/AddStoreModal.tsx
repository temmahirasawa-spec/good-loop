"use client";

import { useEffect, useState } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { BUSINESS_CATEGORIES } from "@/lib/admin/constants";

type NewStore = { id: string; name: string; slug: string; loopTheme: string };
type PlaceSuggestion = { placeId: string; name: string; address: string };

/**
 * 「＋ 店舗を追加」モーダル（Figma『Modal / 店舗を追加 — PC/SP』、2026-08-06 案1で決定。
 * 2026-08-06、天真の依頼でGoogleマップ紐付けを追加時点に統合。同日、業態と色テーマを分離
 * したため、ここでは業態だけを選ぶ。色（loop_theme）は「ブランドとテーマ」でいつでも
 * 選び直せる。ここでは選んだ業態と同じ色を初期値として保存する（あとで自由に変更できる））。
 *
 * URLスラッグは店舗名の入力から400ms後に自動生成される。生成はサーバー側
 * （lib/admin/store-slug.ts、Claude Haikuでローマ字化）。「編集」を押すと直接書き換えられる
 * — 一度この値で保存すると、QRコードに印刷した後は簡単に変えられないため、送信直前まで
 * 確認・修正できるようにしている。
 *
 * Googleマップの紐付けは店舗編集モーダル（StoreEditModal）と同じ検索UI・同じ
 * POST /api/admin/places/search を使う。ここで選んでおくと、保存直後からQRコードの
 * 送客先・お客様の★4/5評価後のGoogleマップ遷移先が有効になる（未選択でも保存はでき、
 * あとから編集で設定してもよい）。
 */
export function AddStoreModal({ onClose, onCreated }: { onClose: () => void; onCreated: (store: NewStore) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[1].slug); // 飲食店をデフォルトに（launch-plan.md③、現状の主要業態）
  const [slug, setSlug] = useState("");
  const [slugLoading, setSlugLoading] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSlug || name.trim() === "") {
      if (name.trim() === "") setSlug("");
      return;
    }
    setSlugLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/settings/stores/suggest-slug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        const data: { slug?: string } = await res.json();
        setSlug(data.slug ?? "");
      } catch {
        // 失敗しても空欄のまま「編集」から手入力できる
      } finally {
        setSlugLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, editingSlug]);

  useEffect(() => {
    if (placeQuery.trim() === "") {
      setPlaceSuggestions([]);
      return;
    }
    setPlaceSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: placeQuery.trim() }),
        });
        const data: { candidates?: PlaceSuggestion[] } = await res.json();
        setPlaceSuggestions(data.candidates ?? []);
      } catch {
        setPlaceSuggestions([]);
      } finally {
        setPlaceSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [placeQuery]);

  async function handleSave() {
    if (name.trim() === "" || slug.trim() === "") return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          businessCategory: category,
          loopTheme: category, // 初期値は業態と同じ色。あとで「ブランドとテーマ」から自由に変更できる
          slug: slug.trim(),
          ...(selectedPlace ? { googlePlaceId: selectedPlace.placeId } : {}),
        }),
      });
      const data: { store?: NewStore; error?: string } = await res.json();
      if (!res.ok || !data.store) {
        setError(data.error ?? "保存できませんでした。もう一度お試しください。");
        setSaving(false);
        return;
      }
      onCreated(data.store);
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
      setSaving(false);
    }
  }

  const canSave = name.trim() !== "" && slug.trim() !== "" && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full flex-col items-start gap-4 overflow-y-auto rounded-t-[20px] p-6 md:w-[560px] md:rounded-2xl"
        style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-4 w-full items-center justify-center md:hidden">
          <span className="block h-1 w-10 rounded-full opacity-40" style={{ backgroundColor: "var(--product-color-text-tertiary)" }} />
        </div>
        <p className="text-[17px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          店舗を追加
        </p>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            店舗名（管理画面での表示名）
          </p>
          <ReviewInput value={name} onChange={setName} placeholder="例：大阪本町店" />
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            業態
          </p>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            アンケート項目のプリセットが決まります。色は後から「ブランドとテーマ」で選べます
          </p>
          <div className="flex w-full flex-wrap items-start gap-2 pt-1">
            {BUSINESS_CATEGORIES.map((c) => {
              const selected = c.slug === category;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategory(c.slug)}
                  className="flex min-h-[44px] items-center rounded-full border px-5 py-3"
                  style={{
                    backgroundColor: selected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? "var(--review-accent-primary)" : "var(--product-color-border-divider)",
                  }}
                >
                  <span className="whitespace-nowrap text-sm" style={{ color: "var(--product-color-text-primary)", fontWeight: selected ? 700 : 500 }}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            Googleマップ上のお店
          </p>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            店名で検索して選ぶと、QRコードとお客様の★4・5評価から、このお店のクチコミ投稿画面へ直接誘導できます
          </p>
          <ReviewInput value={placeQuery} onChange={setPlaceQuery} placeholder="店名で検索（あとから設定することもできます）" />
          {placeQuery.trim() !== "" && (
            <div className="flex w-full flex-col items-start rounded-xl border" style={{ borderColor: "var(--product-color-border-default)" }}>
              {placeSearching && (
                <p className="px-4 py-3 text-[12.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  検索中…
                </p>
              )}
              {!placeSearching && placeSuggestions.length === 0 && (
                <p className="px-4 py-3 text-[12.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  見つかりませんでした
                </p>
              )}
              {placeSuggestions.map((s) => {
                const isSelected = selectedPlace?.placeId === s.placeId;
                return (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => setSelectedPlace(s)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    style={{ backgroundColor: isSelected ? "var(--review-accent-wash)" : "transparent" }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                        {s.name}
                      </p>
                      <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                        {s.address}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-sm font-bold" style={{ color: "var(--review-accent-primary)" }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {selectedPlace && (
            <div className="flex w-full flex-col items-start gap-1 rounded-xl p-4" style={{ backgroundColor: "var(--review-accent-wash)" }}>
              <p className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
                ✓ 紐付けが完了しました
              </p>
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                お客様は「{selectedPlace.name}」のクチコミ投稿画面へ直接誘導されます
              </p>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            お客様が開くURL（店舗名から自動で作成）
          </p>
          {editingSlug ? (
            <ReviewInput value={slug} onChange={setSlug} placeholder="半角英数字とハイフン" />
          ) : (
            <div
              className="flex h-11 w-full items-center justify-between rounded-xl px-4"
              style={{ backgroundColor: "var(--product-color-bg-primary)" }}
            >
              <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                {slugLoading ? "作成中…" : slug ? `app.good-review.jp/r/${slug}` : "店舗名を入力すると自動で作成されます"}
              </p>
              <button type="button" onClick={() => setEditingSlug(true)} className="text-xs font-bold shrink-0" style={{ color: "var(--review-accent-primary)" }}>
                編集
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="w-full text-[12.5px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
            {error}
          </p>
        )}

        <div className="flex w-full items-center justify-between pt-2">
          <button type="button" onClick={onClose} className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            キャンセル
          </button>
          <div className="w-fit">
            <ReviewButton variant="primary" onClick={handleSave} disabled={!canSave}>
              {saving ? "保存中…" : "保存する"}
            </ReviewButton>
          </div>
        </div>
      </div>
    </div>
  );
}
