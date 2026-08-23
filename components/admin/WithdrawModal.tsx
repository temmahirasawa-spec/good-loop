"use client";

import { useState } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";

const CONFIRM_WORD = "退会";

/** 退会の確認モーダル（Figma node 75:1449 PC / 76:1736 SP）。「退会」と入力するまで実行ボタンは非活性 */
export function WithdrawModal({
  onClose,
  onConfirm,
  confirming,
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  const [input, setInput] = useState("");
  const canConfirm = input === CONFIRM_WORD && !confirming;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        className="flex w-full flex-col items-start gap-4 rounded-t-[20px] p-6 md:w-[480px] md:rounded-2xl"
        style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-4 w-full items-center justify-center md:hidden">
          <span className="block h-1 w-10 rounded-full opacity-40" style={{ backgroundColor: "var(--product-color-text-tertiary)" }} />
        </div>
        <p className="text-[17px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          本当に退会しますか？
        </p>

        <div className="flex w-full flex-col items-start gap-2 rounded-xl p-4 text-[12.5px] font-medium" style={{ backgroundColor: "var(--product-color-status-warning-wash)", color: "var(--product-color-status-warning)" }}>
          <p>・すべての店舗の二次元コードが使えなくなります（店頭のコードも無効になります）</p>
          <p>・回答データ・集計はすべて削除され、復元できません</p>
          <p>・Googleに投稿されたクチコミはそのまま残ります</p>
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            確認のため「{CONFIRM_WORD}」と入力してください
          </p>
          <ReviewInput value={input} onChange={setInput} />
        </div>

        <div className="flex w-full items-center justify-between pt-2">
          <div className="w-fit">
            <ReviewButton variant="outline" onClick={onClose}>
              退会せずに続ける
            </ReviewButton>
          </div>
          <div className="w-fit">
            {/* 取り消せない操作なので danger（白地＋赤の枠）。UI検証Q4で決めた体系 */}
            <ReviewButton variant="danger" disabled={!canConfirm} onClick={onConfirm}>
              {confirming ? "処理中…" : "退会する"}
            </ReviewButton>
          </div>
        </div>
      </div>
    </div>
  );
}
