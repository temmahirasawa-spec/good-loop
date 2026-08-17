"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AI視認性チェッカーの画面で使う小さなフック。
 *
 * アニメーションは必ず `usePrefersReducedMotion()` を通すこと
 * （2026-08-17 天真の指示。動きを減らす設定の人には動かさない）。
 */

/** OSの「視差効果を減らす」設定を見る。設定変更にも追従する */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * マウント直後に false → true へ切り替わる。
 * CSSの transition だけで「出現」を表現するために使う（@keyframes を足さずに済ませる）。
 */
export function useMounted(delayMs = 0): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return mounted;
}

/** 0 から to までカウントアップする。動きを減らす設定のときは即座に to を返す */
export function useCountUp(to: number, durationMs: number, enabled: boolean): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (reduced || durationMs <= 0) {
      setValue(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // ease-out cubic。終わりに向かってゆっくり止まる
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [to, durationMs, enabled, reduced]);

  return value;
}
