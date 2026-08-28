"use client";

import { useEffect, useRef } from "react";
import { AiSparkleIcon } from "@/components/rating-flow/icons";
import type { KansouGroup } from "@/lib/demo/fact-model";

/**
 * 今日の感想（docs/specs/survey-v2.md §18、2026-08-28 の再設計）。
 *
 * **口コミ文をリアルタイム生成する場所ではなく、回答した内容を整理する場所。**
 * アンケート中に文章は出さない。選んだタグが意味のまとまり（料理／接客／…）へ
 * 集まっていく様子だけを見せる。
 *
 * ユーザーに感じてほしいのは「勝手に文章が作られている」ではなく、
 * 「自分が感じたことが、少しずつ整理されている」。
 */
export function KansouPanel({
  groups,
  freshChips,
  chipZoneRef,
  expanded,
  onToggle,
  emptyHint,
}: {
  groups: KansouGroup[];
  /** 直近に届いたタグ（到着した瞬間だけ淡く光る） */
  freshChips: string[];
  /** タグの吸い込み先の座標を親が取るための ref */
  chipZoneRef: React.RefObject<HTMLDivElement>;
  expanded: boolean;
  onToggle: () => void;
  emptyHint: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const count = groups.reduce((a, g) => a + g.chips.length, 0);

  // タグが増えたら、いちばん新しいまとまりが見えるように下端へ
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div
      className="pointer-events-auto relative flex w-full flex-col rounded-t-[var(--product-radius-lg)] border-t-[1.5px] border-solid px-[var(--product-space-20)] pb-[var(--product-space-12)] pt-[var(--product-space-4)] transition-[max-height] duration-300"
      style={{
        maxHeight: expanded ? "55dvh" : count > 0 ? 200 : 68,
        backgroundColor: "color-mix(in srgb, var(--product-color-surface-white) 72%, transparent)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderColor: "color-mix(in srgb, var(--review-accent-primary) 55%, transparent)",
        boxShadow: "0 -10px 30px color-mix(in srgb, var(--product-color-text-primary) 8%, transparent)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--review-accent-primary) 70%, transparent), transparent)",
        }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex h-9 w-full shrink-0 items-center justify-between gap-[var(--product-space-8)]"
      >
        <span className="flex items-center gap-[var(--product-space-8)]">
          <AiSparkleIcon className="size-[15px] shrink-0" />
          <span className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
            今日の感想
          </span>
          {count > 0 ? (
            <span
              className="flex min-w-5 items-center justify-center rounded-[var(--product-radius-full)] px-[var(--product-space-4)] text-[11px] font-bold tabular-nums"
              style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}
            >
              {count}
            </span>
          ) : null}
        </span>
        {count > 0 ? (
          <span className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {expanded ? "閉じる" : "全部見る"}
          </span>
        ) : null}
      </button>

      <div ref={bodyRef} className="flex w-full flex-1 flex-col gap-[var(--product-space-8)] overflow-y-auto">
        {count === 0 ? (
          <p ref={chipZoneRef as unknown as React.RefObject<HTMLParagraphElement>} className="text-[14px] leading-[1.8]" style={{ color: "var(--product-color-text-muted)" }}>
            {emptyHint}
          </p>
        ) : (
          <div ref={chipZoneRef} className="flex w-full flex-col gap-[var(--product-space-8)]">
            {groups.map((group) => (
              <div key={group.id} className="review-rise flex w-full flex-col gap-[var(--product-space-4)]">
                <p className="text-[11px] font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
                  {group.title}
                </p>
                <div className="flex w-full flex-wrap items-center gap-[var(--product-space-4)]">
                  {group.chips.map((chip) => (
                    <span
                      key={chip.id}
                      className={`review-rise flex items-center rounded-[var(--product-radius-full)] px-[var(--product-space-8)] py-[2px] text-[13px] font-bold ${
                        freshChips.includes(chip.label) ? "review-flash" : ""
                      }`}
                      style={{
                        backgroundColor: freshChips.includes(chip.label)
                          ? undefined
                          : chip.lead
                            ? "var(--review-accent-wash)"
                            : chip.polarity === "negative"
                              ? "var(--product-color-status-warning-wash)"
                              : "var(--product-color-bg-tertiary)",
                        color: chip.lead
                          ? "var(--review-accent-primary)"
                          : chip.polarity === "negative"
                            ? "var(--product-color-status-warning)"
                            : "var(--product-color-text-secondary)",
                      }}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
