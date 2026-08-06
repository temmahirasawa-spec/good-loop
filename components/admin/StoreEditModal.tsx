"use client";

import { useEffect, useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PlaceSuggestion = { placeId: string; name: string; address: string };

/**
 * 店舗編集モーダル（Figma node 75:1416 PC / 76:1658 SP）。
 *
 * 店名検索は POST /api/admin/places/search（Google Places API、サーバー側の鍵を使用）。
 * 保存は stores.name / stores.google_place_id を直接更新する（RLSでテナント分離される
 * ため、admin clientは使わない）。
 *
 * 既にGoogleマップと連携済みの店舗を開いたときも、保存済みの google_place_id からは
 * 店名・住所を復元できない（Places Details APIを追加で叩けば可能だが、今回は簡易化のため
 * 未実装）。連携状態を確認・変更したい場合は再検索して選び直す運用とする。
 */
export function StoreEditModal({
  storeId,
  storeName,
  linked,
  onClose,
  onSave,
}: {
  storeId: string;
  storeName: string;
  linked: boolean;
  onClose: () => void;
  onSave: (nextName: string) => void;
}) {
  const [name, setName] = useState(storeName);
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
      .update({ name, ...(selected ? { google_place_id: selected.placeId } : {}) })
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
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    style={{ backgroundColor: isSelected ? "var(--loop-accent-wash)" : "transparent" }}
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
                      <span className="text-sm font-bold" style={{ color: "var(--loop-accent-action)" }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="flex w-full flex-col items-start gap-2 rounded-xl p-4" style={{ backgroundColor: "var(--loop-accent-wash)" }}>
            <p className="text-[13px] font-bold" style={{ color: "var(--loop-accent-action)" }}>
              ✓ 紐付けが完了しました
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
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
