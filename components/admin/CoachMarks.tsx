"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { COACH_MARKS, COACH_MARKS_DONE_KEY } from "@/lib/admin/coach-marks";

/**
 * コーチマークの本体（Figma `Review / Coach Tip` 613:7535、適用例は 09 セクション）。
 *
 * 見た目は Figma の適用例のとおり「暗いオーバーレイ ＋ 対象だけ切り抜き ＋ 白い吹き出し」。
 * 切り抜きは clip-path（evenodd）で暗幕に四角い穴を開けて作る。
 *
 * 対象は `data-coach="<id>"` を持つナビ項目（AdminSidebar / AdminMobileNav）。
 * 表示のタイミングは呼び出し側が決める（PC=初回表示・SP=初めてドロワーを開いたとき）。
 */
export function CoachMarks({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const mark = COACH_MARKS[index];

  const measure = useCallback(() => {
    // 同じ data-coach が PCサイドバーと SPドロワーの2箇所にある。
    // querySelector の最初の一致は display:none 側のことがあるため、**見えているほう**を選ぶ
    const el = Array.from(document.querySelectorAll<HTMLElement>(`[data-coach="${mark.id}"]`)).find(
      (e) => e.offsetParent !== null,
    );
    const next = el ? el.getBoundingClientRect() : null;
    // 毎回 setState すると無限再描画になるため、位置が動いたときだけ更新する
    setRect((prev) => {
      if (!next) return null;
      if (prev && Math.abs(prev.top - next.top) < 1 && Math.abs(prev.left - next.left) < 1) return prev;
      return next;
    });
  }, [mark.id]);

  useEffect(() => {
    measure();
    // ドロワーは開くときにスライドのアニメーションが走る。開いた瞬間に測ると
    // 途中の位置を掴んでしまうため、落ち着くまで短い間隔で測り直す
    const timer = setInterval(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  function finish() {
    try {
      localStorage.setItem(COACH_MARKS_DONE_KEY, "1");
    } catch {
      // 保存できなければ次回また出るだけ。害はない
    }
    onFinish();
  }

  function next() {
    if (index + 1 >= COACH_MARKS.length) {
      finish();
      return;
    }
    setIndex(index + 1);
  }

  // 対象が見つからないときは何も出さない（レイアウト変更で壊れたときに画面を塞がないため）
  if (!rect) return null;

  // 吹き出しの位置: PCはサイドバーの右隣、SP（ドロワー）は項目の下
  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
  const tipStyle: React.CSSProperties = isDesktop
    ? { top: Math.max(16, rect.top), left: rect.right + 16 }
    : { top: rect.bottom + 12, left: 16, right: 16 };

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-label="画面の説明">
      {/* 暗幕。対象のまわりに上下左右の4枚の帯を敷いて、対象の場所だけ穴を開ける
          （clip-path の evenodd や巨大な box-shadow は、環境によって描画されないことがあった） */}
      {(() => {
        const hole = { top: rect.top - 4, left: rect.left - 4, right: rect.right + 4, bottom: rect.bottom + 4 };
        const shade = "color-mix(in srgb, var(--product-color-surface-ink) 55%, transparent)";
        return (
          <>
            <div className="absolute inset-x-0 top-0" style={{ height: Math.max(0, hole.top), backgroundColor: shade }} />
            <div className="absolute inset-x-0 bottom-0" style={{ top: hole.bottom, backgroundColor: shade }} />
            <div className="absolute left-0" style={{ top: hole.top, height: hole.bottom - hole.top, width: Math.max(0, hole.left), backgroundColor: shade }} />
            <div className="absolute right-0" style={{ top: hole.top, height: hole.bottom - hole.top, left: hole.right, backgroundColor: shade }} />
          </>
        );
      })()}
      {/* Review / Coach Tip（Figma 613:7535）: 白カード・radius12・本文13 */}
      <div
        className="absolute flex w-[280px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-xl p-4"
        style={{ ...tipStyle, backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.18)" }}
      >
        <p className="text-[13px] font-medium leading-[1.6]" style={{ color: "var(--product-color-text-primary)" }}>
          {mark.text}
        </p>
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[11.5px] font-medium tabular-nums" style={{ color: "var(--product-color-text-secondary)" }}>
            {index + 1} / {COACH_MARKS.length}
          </p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={finish} className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              閉じる
            </button>
            <button
              type="button"
              onClick={next}
              className="rounded-lg px-4 py-2 text-xs font-bold"
              style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
            >
              {index + 1 >= COACH_MARKS.length ? "おわる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** まだ見ていないか（見終わっていたら二度と出さない） */
export function coachMarksPending(): boolean {
  try {
    return localStorage.getItem(COACH_MARKS_DONE_KEY) !== "1";
  } catch {
    return false; // localStorage が使えない環境では出さない（毎回出るよりまし）
  }
}

/**
 * PC用の起動係。管理画面（サイドバーが見えている状態）を初めて開いたときに始める。
 * SPはドロワーの中の項目を指すため、AdminMobileTopBar 側が開いたタイミングで出す。
 */
export function CoachMarksAutoStart() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop && coachMarksPending()) setActive(true);
  }, []);

  if (!active) return null;
  return <CoachMarks onFinish={() => setActive(false)} />;
}
