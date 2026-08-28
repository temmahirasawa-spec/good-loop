"use client";

import { useEffect, useRef, useState } from "react";
import { AiSparkleIcon } from "@/components/rating-flow/icons";

/**
 * 感想の器（docs/specs/survey-v2.md 段1・案C）。
 *
 * **画面の下に置き、選ぶたびに文章が1文字ずつ増えていく。**
 * 「選んでいるうちに自分の感想になっていく」を比喩ではなく画面上の事実にするための部品。
 *
 * 演出の決まり（2026-08-28 天真の指示）:
 *   ・タップ直後は「書いています」＋点の明滅（AIがその場で考えている感じ）
 *   ・そのあと**タイピングのように**文字が出る
 *   ・文が減ったとき（選択を外した）は演出せず即座に反映する。待たされる意味がないため
 *   ・器はいつでもタップで開閉できる。畳んでいる間も最後の2行は見えている
 */

const THINKING_MS = 280;
const TYPE_INTERVAL_MS = 18;

export function DraftCanvas({
  text,
  expanded,
  onToggle,
  emptyHint,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
  emptyHint: string;
}) {
  const { shown, busy } = useTypewriter(text);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  // 書き足されるたびに最後を見せる
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  return (
    <div
      className="pointer-events-auto w-full rounded-t-[var(--product-radius-lg)] border-t-[1.5px] border-solid px-[var(--product-space-20)] pb-[var(--product-space-16)] pt-[var(--product-space-12)]"
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderColor: "var(--review-accent-primary)",
        boxShadow: "0 -8px 24px rgb(0 0 0 / 0.06)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex h-11 w-full items-center justify-between gap-[var(--product-space-8)]"
      >
        <span className="flex items-center gap-[var(--product-space-8)]">
          <AiSparkleIcon className="size-[15px] shrink-0" />
          <span className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
            {busy ? "書いています" : "あなたの感想"}
          </span>
          {busy ? (
            <span className="flex items-center gap-[3px]" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="review-pulse size-[5px] rounded-[var(--product-radius-full)]"
                  style={{ backgroundColor: "var(--review-accent-primary)", animationDelay: `${i * 160}ms` }}
                />
              ))}
            </span>
          ) : null}
        </span>
        <span className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          {expanded ? "閉じる" : "全文を見る"}
        </span>
      </button>

      <p
        ref={bodyRef}
        className="w-full overflow-y-auto text-[15px] leading-[1.9] transition-[max-height] duration-300"
        style={{
          maxHeight: expanded ? 260 : 60,
          color: shown ? "var(--product-color-text-primary)" : "var(--product-color-text-muted)",
        }}
      >
        {shown || emptyHint}
        {busy ? (
          <span
            className="review-caret ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px]"
            style={{ backgroundColor: "var(--review-accent-primary)" }}
            aria-hidden
          />
        ) : null}
      </p>
    </div>
  );
}

/**
 * 文字を1つずつ出す。**足されたときだけ**演出し、消えたときは即座に反映する。
 * `text` だけを依存にし、途中経過は ref で持つ（state を依存に入れると自分で自分を起こしてしまう）。
 */
export function useTypewriter(text: string) {
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(false);
  const shownRef = useRef("");

  useEffect(() => {
    if (text === shownRef.current) return;

    // 減った・入れ替わった → 演出しない
    if (!text.startsWith(shownRef.current)) {
      shownRef.current = text;
      setShown(text);
      setBusy(false);
      return;
    }

    setBusy(true);
    let typer: ReturnType<typeof setInterval> | undefined;
    // まず少し「考える」。ここがあるだけでAIが働いて見える
    const starter = setTimeout(() => {
      typer = setInterval(() => {
        const next = text.slice(0, shownRef.current.length + 1);
        shownRef.current = next;
        setShown(next);
        if (next.length >= text.length) {
          if (typer) clearInterval(typer);
          setBusy(false);
        }
      }, TYPE_INTERVAL_MS);
    }, THINKING_MS);

    return () => {
      clearTimeout(starter);
      if (typer) clearInterval(typer);
    };
  }, [text]);

  return { shown, busy };
}
