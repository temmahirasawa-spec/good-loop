"use client";

import { useEffect, useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { BUSINESS_CATEGORIES } from "@/lib/admin/constants";

type PlaceSuggestion = { placeId: string; name: string; address: string };

/**
 * 店舗編集モーダル（Figma node 75:1416 PC / 76:1658 SP）。
 *
 * 店名検索は POST /api/admin/places/search（Google Places API、サーバー側の鍵を使用）。
 * 保存は stores.name / stores.business_category / stores.google_place_id を直接更新する
 * （RLSでテナント分離されるため、admin clientは使わない）。
 *
 * 既にGoogleマップと連携済みの店舗を開いたときも、保存済みの google_place_id からは
 * 店名・住所を復元できない（Places Details APIを追加で叩けば可能だが、今回は簡易化のため
 * 未実装）。連携状態を確認・変更したい場合は再検索して選び直す運用とする。
 *
 * 業態選択は2026-08-06に追加した（業態と色テーマの分離にともない、店舗追加だけでなく
 * 編集でも業態を変更できるようにした）。
 */
export function StoreEditModal({
  storeId,
  storeName,
  businessCategory,
  linked,
  onClose,
  onSave,
}: {
  storeId: string;
  storeName: string;
  businessCategory: string;
  linked: boolean;
  onClose: () => void;
  onSave: (nextName: string) => void;
}) {
  const [name, setName] = useState(storeName);
  const [category, setCategory] = useState(businessCategory);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PlaceSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim() === "") {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data: { candidates?: PlaceSuggestion[] } = await res.json();
        setSuggestions(data.candidates ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("stores")
      .update({ name, business_category: category, ...(selected ? { google_place_id: selected.placeId } : {}) })
      .eq("id", storeId);
    setSaving(false);
    if (updateError) {
      setError("保存できませんでした。もう一度お試しください。");
      return;
    }
    onSave(name);
  }

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
          店舗を編集
        </p>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            店舗名（管理画面での表示名）
          </p>
          <LoopInput value={name} onChange={setName} />
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            業態
          </p>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            アンケート項目のプリセットが決まります
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
                    backgroundColor: selected ? "var(--loop-accent-wash)" : "var(--product-color-surface-white)",
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? "var(--loop-accent-primary)" : "var(--product-color-border-divider)",
                  }}
                >
                  {/* ひとまわり大きく（2026-08-23、Figmaコメント 1895821748「タグのサイズが小さすぎる」） */}
                  <span className="whitespace-nowrap text-sm" style={{ color: "var(--product-color-text-primary)", fontWeight: selected ? 700 : 500 }}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            Googleマップ上のお店（店名で検索して選択）
          </p>
          {linked && !selected && (
            <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
              既に連携済みです。変更する場合は再検索して選び直してください
            </p>
          )}
          <LoopInput value={query} onChange={setQuery} placeholder="店名で検索" />
          {query.trim() !== "" && (
            <div className="flex w-full flex-col items-start rounded-xl border" style={{ borderColor: "var(--product-color-border-default)" }}>
              {searching && (
                <p className="px-4 py-3 text-[12.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  検索中…
                </p>
              )}
              {!searching && suggestions.length === 0 && (
                <p className="px-4 py-3 text-[12.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                  見つかりませんでした
                </p>
              )}
              {suggestions.map((s) => {
                const isSelected = selected?.placeId === s.placeId;
                return (
                  <button
                    key={s.placeId}
                    type="button"
                    onClick={() => setSelected(s)}
                    // 選択中を緑の背景で示すと、上の業態チップのアクティブと見分けがつかない
                    // （2026-08-22 天真のFigmaコメント）。背景は使わず、店名だけ緑にする
                    className="flex w-full items-center justify-between border-b px-4 py-4 text-left"
                    style={{ borderColor: "var(--product-color-border-divider)" }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <p
                        className="text-[13.5px] font-bold"
                        style={{ color: isSelected ? "var(--loop-accent-primary)" : "var(--product-color-text-primary)" }}
                      >
                        {s.name}
                      </p>
                      <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                        {s.address}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-sm font-bold" style={{ color: "var(--loop-accent-primary)" }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 注釈（Loop / Note）と同じ形（2026-08-23、Figmaコメント 1895841282「同じ部品の載せ替え」） */}
        {selected && (
          <div
            className="flex w-full flex-col items-start gap-1 rounded-lg px-4 py-3"
            style={{ backgroundColor: "var(--loop-accent-wash)" }}
          >
            <p className="text-[13px] font-bold" style={{ color: "var(--loop-accent-primary)" }}>
              ✓ 紐付けが完了しました
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--product-color-text-primary)" }}>
              お客様は「{selected.name}」のクチコミ投稿画面へ直接誘導されます
            </p>
          </div>
        )}

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
            <LoopButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </LoopButton>
          </div>
        </div>
      </div>
    </div>
  );
}
