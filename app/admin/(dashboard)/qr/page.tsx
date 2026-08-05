"use client";

import { useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { QrCard, QrCardMobile } from "@/components/admin/QrCard";
import { LoopButton } from "@/components/rating-flow/Button";
import { STORES } from "@/lib/admin/mock-data";

// Figmaのサンプル値（実データはSupabase接続後、店舗ごとのQR読み取りログから出す）
const READS: Record<string, number> = {
  sannomiya: 132,
  "kobe-motomachi": 96,
  "kyoto-shijo": 88,
  umeda: 58,
  "osaka-honmachi": 12,
};

const SP_COLLAPSED_COUNT = 2;

/** Dashboard / 二次元コード発行（Figma node 56:931 PC / 56:1292 SP） */
export default function AdminQrPage() {
  const [spExpanded, setSpExpanded] = useState(false);
  const visibleForSp = spExpanded ? STORES : STORES.slice(0, SP_COLLAPSED_COUNT);
  const hiddenCount = STORES.length - SP_COLLAPSED_COUNT;

  return (
    <>
      <AdminMobileTopBar title="二次元コード発行" storeName="YORKYS BRUNCH" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div className="flex flex-col items-start gap-2">
          <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            二次元コード発行
          </p>
          <p className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            印刷して店舗に置くだけで、アンケートとレビュー送客が始まります
          </p>
        </div>
        <div className="w-fit">
          <LoopButton variant="primary">＋ 新しい二次元コードを発行</LoopButton>
        </div>
      </div>

      <p className="text-[12.5px] font-medium md:hidden" style={{ color: "var(--product-color-text-secondary)" }}>
        印刷して店舗に置くだけで、アンケートとレビュー送客が始まります
      </p>
      <div className="w-full md:hidden">
        <LoopButton variant="primary">＋ 新しい二次元コードを発行</LoopButton>
      </div>

      <div className="flex w-full flex-wrap items-start gap-4">
        {STORES.map((store) => {
          const reads = READS[store.id] ?? 0;
          return <QrCard key={store.id} storeName={store.name} reads={reads} low={reads < 20} />;
        })}
      </div>

      <div className="flex w-full flex-col items-start gap-3 md:hidden">
        {visibleForSp.map((store) => {
          const reads = READS[store.id] ?? 0;
          return <QrCardMobile key={store.id} storeName={store.name} reads={reads} low={reads < 20} />;
        })}
        {!spExpanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setSpExpanded(true)}
            className="text-[12.5px] font-medium"
            style={{ color: "var(--product-color-text-tertiary)" }}
          >
            ほか{hiddenCount}店舗 ▾
          </button>
        )}
      </div>
    </>
  );
}
