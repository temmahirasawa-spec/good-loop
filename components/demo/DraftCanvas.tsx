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

/** 1行ぶんの高さ（15px × 行送り1.9）。器の高さはこれを基準に決める */
const LINE_HEIGHT = 28.5;

/**
 * 表示の速さ（**文字/ミリ秒**）。溜まっているぶんが多いほど速くする。
 *
 * ストリーミングは塊で届くので、受け取った端から描くとカクつく。
 * 受信（不均一）と表示（等速）を切り離し、**画面の更新に合わせて**吐き出す。
 */
function speedFor(remaining: number): number {
  if (remaining > 160) return 0.35;
  if (remaining > 80) return 0.16;
  if (remaining > 30) return 0.09;
  return 0.055;
}

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
  /** 直前の目標文字列の長さ。ここから先が「新しく言葉になった部分」 */
  const stableRef = useRef(0);
  const prevTargetRef = useRef("");
  const [highlightUntil, setHighlightUntil] = useState(0);

  useEffect(() => {
    if (text === prevTargetRef.current) return;
    // 目標が伸びた＝新しい句が来た。それまでの長さを「確定済み」として覚える
    stableRef.current = text.startsWith(prevTargetRef.current) ? prevTargetRef.current.length : 0;
    prevTargetRef.current = text;
    setHighlightUntil(Date.now() + 60_000); // 書き終わりで改めて短くする
  }, [text]);

  useEffect(() => {
    if (busy) return;
    // 書き終わったら、ハイライトを少し見せてから消す
    const timer = setTimeout(() => setHighlightUntil(0), 1200);
    return () => clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);

  /**
   * 器の4状態（チャッピー資料 §08、2026-08-28 採用）:
   *   empty（1行・誘い文だけ）→ writing（4行に展開）→ resting（2行に縮んで質問へ場所を返す）
   *   → expanded（タップで全文）
   */
  /**
   * 高さ（2026-08-28 修正仕様）: empty=1行 / writing=3行（一時的） / resting=2行 / expanded=全文。
   * ヘッダー32px＋余白を含めた全体で、resting が 88〜104px に収まるようにしてある。
   */
  const maxHeight = expanded
    ? 320
    : busy
      ? LINE_HEIGHT * 3
      : shown
        ? LINE_HEIGHT * 2
        : LINE_HEIGHT;

  const stable = Math.min(stableRef.current, shown.length);
  const highlighted = highlightUntil > 0 ? shown.slice(stable) : "";
  const plain = highlightUntil > 0 ? shown.slice(0, stable) : shown;

  return (
    <div
      className="pointer-events-auto w-full rounded-t-[var(--product-radius-lg)] border-t-[1.5px] border-solid px-[var(--product-space-20)] pb-[var(--product-space-12)] pt-[var(--product-space-4)]"
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
        className="flex h-8 w-full items-center justify-between gap-[var(--product-space-8)]"
      >
        <span className="flex items-center gap-[var(--product-space-8)]">
          <AiSparkleIcon className="size-[15px] shrink-0" />
          <span className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
            {busy ? "言葉にしています" : "あなたの感想"}
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
        {shown ? (
          <span className="text-[12px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {expanded ? "閉じる" : "全文を見る"}
          </span>
        ) : null}
      </button>

      <p
        ref={bodyRef}
        className="w-full overflow-y-auto text-[15px] leading-[1.9] transition-[max-height] duration-300"
        style={{
          maxHeight,
          color: shown ? "var(--product-color-text-primary)" : "var(--product-color-text-muted)",
        }}
      >
        {plain || (shown ? "" : emptyHint)}
        {highlighted ? (
          // 新しく言葉になった部分だけを示す（書き終わって1.2秒で外す）。
          // 黄色のwashはトークン未整備のため warning-wash を仮借用（警告の意味ではない。
          // 本採用時は Figma に「新しい句」の色を足してから正式なトークンにする）
          <mark style={{ backgroundColor: "var(--product-color-status-warning-wash)", color: "inherit" }}>{highlighted}</mark>
        ) : null}
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
export function useTypewriter(text: string, options?: { instant?: boolean }) {
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(false);
  const shownRef = useRef("");

  useEffect(() => {
    if (options?.instant) {
      shownRef.current = text;
      setShown(text);
      setBusy(false);
      return;
    }
    if (text === shownRef.current) {
      setBusy(false);
      return;
    }

    // 減った・入れ替わった → 演出しない（待たせる意味がない）
    if (!text.startsWith(shownRef.current)) {
      shownRef.current = text;
      setShown(text);
      setBusy(false);
      return;
    }

    setBusy(true);

    /**
     * **画面の更新に合わせて進める**（2026-08-28、天真「まだカクつく」への対応）。
     *
     * setTimeout は指定より遅れて発火し、間隔がばらつく（4ms 指定でも実際は 5〜15ms）。
     * その揺れがそのまま文字の出方のムラになっていた。
     * requestAnimationFrame なら**描画のタイミングそのもの**で呼ばれるので、
     * 1フレーム＝1回だけ更新すればよく、進める文字数を経過時間から決められる。
     */
    let raf = 0;
    let startedAt = 0;
    let last = 0;

    const frame = (now: number) => {
      if (startedAt === 0) {
        startedAt = now;
        last = now;
      }
      // 書き始めだけ、少し間を置く（AIが考えているように見せる）
      if (shownRef.current.length === 0 && now - startedAt < THINKING_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const elapsed = now - last;
      last = now;
      const remaining = text.length - shownRef.current.length;
      // 1フレームで進める文字数。最低1字は進める（止まって見えないように）
      const advance = Math.max(1, Math.round(elapsed * speedFor(remaining)));
      const next = text.slice(0, Math.min(text.length, shownRef.current.length + advance));
      shownRef.current = next;
      setShown(next);

      if (next.length >= text.length) {
        setBusy(false);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [text, options?.instant]);

  return { shown, busy };
}
