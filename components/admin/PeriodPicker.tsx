"use client";

import { useEffect, useRef, useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { PERIOD_PRESETS, type PeriodPresetCode, type PeriodValue } from "@/lib/admin/period";

/**
 * 期間の選択（Figma `Modal / 期間を選ぶ — PC` / `期間を選ぶ — SP 390`）。
 *
 * 2026-08-22、天真の決定（docs/ui-review.md Q9 ＋ Figmaコメント）で、
 * ピル4つの並びから「押すまで中身が隠れる」形に変えた。Stripeのダッシュボードに近い形。
 *
 *   閉じているとき … 「直近7日 ▾」の1行だけ
 *   PC … 左によく使う期間、右にカレンダー（幅452px）
 *   SP … 縦積みのボトムシート。左右2枚だとSPの内側358pxに94pxはみ出すため（実測）
 *
 * カレンダーのマス目はSPで44px角。指で押せる大きさにするため。
 */

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** その月の日付を、先頭の空きマスぶん null で埋めた配列にする */
function monthCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

function labelOf(value: PeriodValue): string {
  if ("preset" in value) return PERIOD_PRESETS.find((p) => p.code === value.preset)?.label ?? "期間";
  const short = (d: string) => d.slice(5).replace("-", "/").replace(/^0/, "");
  return `${short(value.from)} 〜 ${short(value.to)}`;
}

export function PeriodPicker({ value, onChange }: { value: PeriodValue; onChange: (next: PeriodValue) => void }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const base = "from" in value ? new Date(`${value.from}T00:00:00+09:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [from, setFrom] = useState<string | null>("from" in value ? value.from : null);
  const [to, setTo] = useState<string | null>("from" in value ? value.to : null);
  const rootRef = useRef<HTMLDivElement>(null);

  // PCでは外側を押したら閉じる（SPは暗幕を押して閉じる）
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function pickDay(day: number) {
    const key = toKey(cursor.year, cursor.month, day);
    // 1回目の選択で開始、2回目で終了。すでに範囲が決まっていたら選び直しとして開始に戻す
    if (!from || (from && to)) {
      setFrom(key);
      setTo(null);
      return;
    }
    if (key < from) {
      setTo(from);
      setFrom(key);
      return;
    }
    setTo(key);
  }

  function applyPreset(code: PeriodPresetCode) {
    setFrom(null);
    setTo(null);
    onChange({ preset: code });
    setOpen(false);
  }

  function applyRange() {
    if (!from) return;
    onChange({ from, to: to ?? from });
    setOpen(false);
  }

  const cells = monthCells(cursor.year, cursor.month);
  const activePreset = "preset" in value ? value.preset : null;

  const calendar = (
    <div className="flex flex-col items-start gap-[10px]">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))}
          className="px-1 text-base font-bold"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          ‹
        </button>
        <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {cursor.year}年{cursor.month + 1}月
        </p>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))}
          className="px-1 text-base font-bold"
          style={{ color: "var(--product-color-text-secondary)" }}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="flex h-6 items-center justify-center text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} className="size-11 md:size-[34px]" />;
          const key = toKey(cursor.year, cursor.month, day);
          const isEdge = key === from || key === to;
          const inRange = Boolean(from && to && key > from && key < to);
          return (
            <button
              key={key}
              type="button"
              onClick={() => pickDay(day)}
              className="flex size-11 items-center justify-center text-[13px] md:size-[34px] md:text-[11px]"
              style={{
                backgroundColor: isEdge ? "var(--loop-accent-primary)" : inRange ? "var(--loop-accent-wash)" : "transparent",
                color: isEdge ? "var(--loop-accent-on-primary)" : "var(--product-color-text-primary)",
                fontWeight: isEdge ? 700 : 400,
                borderRadius: isEdge ? "var(--product-radius-sm)" : 0,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );

  const presetList = (
    <div className="flex flex-wrap gap-2 md:w-[150px] md:flex-col md:flex-nowrap md:gap-0.5">
      {PERIOD_PRESETS.map((preset) => {
        const active = activePreset === preset.code;
        return (
          <button
            key={preset.code}
            type="button"
            onClick={() => applyPreset(preset.code)}
            className="flex min-h-11 items-center rounded-full px-4 py-2 md:min-h-0 md:rounded-[10px] md:px-3 md:py-[9px]"
            style={{
              backgroundColor: active ? "var(--loop-accent-wash)" : "transparent",
              border: active ? "none" : "1px solid var(--product-color-border-default)",
              color: active ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)",
              fontWeight: active ? 700 : 400,
            }}
          >
            <span className="whitespace-nowrap text-[12.5px] md:text-[13px]">{preset.label}</span>
          </button>
        );
      })}
      <span
        className="flex min-h-11 items-center rounded-full px-4 py-2 md:min-h-0 md:rounded-[10px] md:px-3 md:py-[9px]"
        style={{
          backgroundColor: from ? "var(--loop-accent-wash)" : "transparent",
          border: from ? "none" : "1px solid var(--product-color-border-default)",
          color: from ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)",
          fontWeight: from ? 700 : 400,
        }}
      >
        <span className="whitespace-nowrap text-[12.5px] md:text-[13px]">期間を指定</span>
      </span>
    </div>
  );

  const summary = from ? `${from} 〜 ${to ?? "…"}` : "カレンダーで開始日と終了日を選べます";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-xl border px-4"
        style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
      >
        <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {labelOf(value)}
        </span>
        <span className="text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
          ▾
        </span>
      </button>

      {open && (
        <>
          {/* SP：ボトムシート */}
          <div className="fixed inset-0 z-50 flex items-end md:hidden" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setOpen(false)}>
            <div
              className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[20px] p-4 pb-6"
              style={{ backgroundColor: "var(--product-color-surface-white)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                期間を選ぶ
              </p>
              {presetList}
              {calendar}
              <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                {summary}
              </p>
              <LoopButton variant="primary" size="lg" disabled={!from} onClick={applyRange}>
                この期間で見る
              </LoopButton>
            </div>
          </div>

          {/* PC：ボタンの下に開くパネル */}
          <div
            // ボタンは見出しの右端にあるので、パネルも右端そろえで左に開く（左そろえだと画面からはみ出す）
            className="absolute right-0 top-[calc(100%+8px)] z-50 hidden flex-col gap-4 rounded-2xl border p-6 md:flex"
            style={{
              backgroundColor: "var(--product-color-surface-white)",
              borderColor: "var(--product-color-border-default)",
              boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)",
            }}
          >
            <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
              期間を選ぶ
            </p>
            <div className="flex items-start gap-5">
              {presetList}
              {calendar}
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                {summary}
              </p>
              <div className="w-[160px]">
                <LoopButton variant="primary" disabled={!from} onClick={applyRange}>
                  この期間で見る
                </LoopButton>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
