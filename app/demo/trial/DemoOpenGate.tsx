"use client";

import { useEffect } from "react";
import { useCardGate } from "@/components/admin/billing/CardGate";

/** 検証用：ページを開いたときにカードの関門（または「有料で始める」の確認）を出しておく */
export function DemoOpenGate({ paid }: { paid: boolean }) {
  const gate = useCardGate();
  useEffect(() => {
    if (paid) gate.openPaidConfirmation("place");
    else gate.requireCard();
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
