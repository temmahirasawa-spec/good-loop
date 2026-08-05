"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";

type PlaceSuggestion = { name: string; address: string };

/**
 * 店舗編集モーダル（Figma node 75:1416 PC / 76:1658 SP）。
 *
 * Google Places APIがまだ無い（docs/setup-tasks.md 3参照）ため、店名検索の候補は
 * ダミーの3件固定。実装時は入力文字列でPlaces APIのText Search（New）を叩く想定。
 * PC は中央モーダル、SP は下からのシート。同じマークアップをブレークポイントで出し分ける。
 */
export function StoreEditModal({
  storeName,
  linked,
  onClose,
  onSave,
}: {
  storeName: string;
  linked: boolean;
  onClose: () => void;
  onSave: (nextName: string) => void;
}) {
  const [name, setName] = useState(storeName);
  const [query, setQuery] = useState(linked ? `${storeName.replace(/店$/, "")}` : "");
  const [selected, setSelected] = useState<PlaceSuggestion | null>(linked ? { name: `YORKYS BRUNCH ${storeName}`, address: "住所は選択後にPlaces APIから取得" } : null);

  const suggestions: PlaceSuggestion[] = [
    { name: `YORKYS BRUNCH ${storeName}`, address: "住所は選択後にPlaces APIから取得" },
    { name: "YORKYS BRUNCH 梅田店", address: "大阪府大阪市北区大深町4-20" },
    { name: "ヨーキーズカフェ 大阪城公園", address: "大阪府大阪市中央区大阪城1-1" },
  ];

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
          <LoopInput value={query} onChange={setQuery} placeholder="店名で検索" />
          {query.trim() !== "" && (
            <div className="flex w-full flex-col items-start rounded-xl border" style={{ borderColor: "var(--product-color-border-default)" }}>
              {suggestions.map((s) => {
                const isSelected = selected?.name === s.name;
                return (
                  <button
                    key={s.name}
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
            <p className="text-xs font-medium" style={{ color: "var(--loop-accent-action)" }}>
              投稿画面を自分で確認する →
            </p>
          </div>
        )}

        <div className="flex w-full items-center justify-between pt-2">
          <button type="button" onClick={onClose} className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            キャンセル
          </button>
          <div className="w-fit">
            <LoopButton variant="primary" onClick={() => onSave(name)}>
              保存する
            </LoopButton>
          </div>
        </div>
      </div>
    </div>
  );
}
