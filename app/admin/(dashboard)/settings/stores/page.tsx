"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { StoreEditModal } from "@/components/admin/StoreEditModal";
import { STORES } from "@/lib/admin/mock-data";

/**
 * 設定（店舗管理） Figma node 73:1364 PC / 75:1803 SP。
 *
 * 「＋ 店舗を追加」は新規店舗のスラッグ・業態設定を伴うため、店舗編集モーダルとは
 * フォームが異なる（未実装）。まずFigmaにある編集フローを実装した。
 */
export default function SettingsStoresPage() {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(STORES.filter((s) => s.googlePlaceLinked).map((s) => s.id)));
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingStore = STORES.find((s) => s.id === editingId) ?? null;

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          店舗管理
        </p>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          店舗ごとに Googleマップ上のお店を店名で検索して紐付けます。紐付けると、お客様をクチコミ投稿画面へ直接誘導できます
        </p>
        {STORES.map((store) => {
          const linked = linkedIds.has(store.id);
          return (
            <div key={store.id} className="flex h-[52px] w-full items-center justify-between border-b px-1" style={{ borderColor: "var(--product-color-border-divider)" }}>
              <div className="flex items-center gap-3">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                  {store.name}
                </p>
                <span
                  className="rounded-full px-2 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: linked ? "var(--loop-accent-wash)" : "var(--product-color-bg-primary)",
                    color: linked ? "var(--loop-accent-action)" : "var(--product-color-status-warning)",
                  }}
                >
                  {linked ? "Googleマップ連携済み" : "URL未設定"}
                </span>
              </div>
              <button type="button" onClick={() => setEditingId(store.id)} className="text-[12.5px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
                編集
              </button>
            </div>
          );
        })}
        <LoopButton variant="primary">＋ 店舗を追加</LoopButton>
      </div>

      {editingStore && (
        <StoreEditModal
          storeName={editingStore.name}
          linked={linkedIds.has(editingStore.id)}
          onClose={() => setEditingId(null)}
          onSave={() => {
            setLinkedIds((prev) => new Set(prev).add(editingStore.id));
            setEditingId(null);
          }}
        />
      )}
    </>
  );
}
