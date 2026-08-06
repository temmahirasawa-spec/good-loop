"use client";

import { useState } from "react";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { QrCard, QrCardMobile } from "@/components/admin/QrCard";
import { LoopButton } from "@/components/rating-flow/Button";
import type { StoreSummary } from "@/lib/admin/types";

const SP_COLLAPSED_COUNT = 2;
const LOW_READS_THRESHOLD = 20;

/**
 * Dashboard / 二次元コード発行（Figma node 56:931 PC / 56:1292 SP）の表示部分。
 * データ取得は親（app/admin/(dashboard)/qr/page.tsx）が行う。
 */
export function QrPageView({ stores }: { stores: StoreSummary[] }) {
  const [spExpanded, setSpExpanded] = useState(false);
  const visibleForSp = spExpanded ? stores : stores.slice(0, SP_COLLAPSED_COUNT);
  const hiddenCount = stores.length - SP_COLLAPSED_COUNT;

  return (
    <>
      <AdminMobileTopBar title="二次元コード発行" />

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
        {stores.map((store) => (
          <QrCard key={store.id} storeName={store.name} reads={store.qrReads} low={store.qrReads < LOW_READS_THRESHOLD} />
        ))}
      </div>

      <div className="flex w-full flex-col items-start gap-3 md:hidden">
        {visibleForSp.map((store) => (
          <QrCardMobile key={store.id} storeName={store.name} reads={store.qrReads} low={store.qrReads < LOW_READS_THRESHOLD} />
        ))}
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
