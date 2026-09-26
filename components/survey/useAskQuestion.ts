"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * v5「続きを聞く」のタイミング（docs/specs/survey-v5.md §3）。
 *
 * **1文字ごとには呼ばない。手が止まったら呼ぶ。** 1回に約1秒かかるので（2026-09-26 実測・中央値0.91秒）、
 * 1文字ごとに出すと打つ速さに追いつかず、呼ぶ回数も10倍以上になる。
 *
 * 呼ぶ条件（すべて満たしたとき）:
 *   ・書く画面を開いている／日本語入力の変換中ではない／整えるの候補が出ていない
 *   ・本文が ASK_MIN_CHARS 以上、ASK_STOP_CHARS 未満（白紙にはAIが現れない。十分書けたら聞かない）
 *   ・前の問いのあと ASK_GAP_CHARS 以上書き足した（答える間を奪わない）
 *   ・出した問いが ASK_MAX_SHOWN 未満、頼んだ回数が ASK_MAX_ATTEMPTS 未満
 *   ・入力が ASK_IDLE_MS 止まった
 *
 * A2「手が止まったら問いを変える」: 問いを出したあと ASK_STUCK_MS 何も打たなければ、
 * 別の角度の問いに1回だけ替える。それでも止まっていたら exitHint（ここまでで投稿できます）を立てる。
 */

/** 問いを頼むまでに、手が止まっている時間 */
export const ASK_IDLE_MS = 1500;
/** 問いを出したあと、何も打たずに止まっていたら別の角度に替えるまでの時間（A2） */
export const ASK_STUCK_MS = 10_000;
/** 1人に出す問いの上限 */
export const ASK_MAX_SHOWN = 3;
/** 頼む回数の上限（検査で落ちて何も出なかったぶんも数える＝費用の上限） */
export const ASK_MAX_ATTEMPTS = 5;
/** 本文がこの長さに届いたら、もう聞かない（十分に書けている。実測で「聞き続ける」が出たため） */
export const ASK_STOP_CHARS = 60;
/** 本文がこの長さに届くまでは聞かない。白紙の問いは静的なプレースホルダが受け持つ */
export const ASK_MIN_CHARS = 4;
/** 問いが出たあと、この文字数を書き足すまでは次の問いを出さない */
export const ASK_GAP_CHARS = 6;

const charCount = (s: string) => Array.from(s.trim()).length;

type Options = {
  body: string;
  /** 日本語入力の変換中（下線がある間）は呼ばない */
  composing: boolean;
  /** 書く画面を開いている間だけ true */
  active: boolean;
  /** 整えるの候補が出ている間は true（問いを引っ込める） */
  paused: boolean;
};

export function useAskQuestion({ body, composing, active, paused }: Options) {
  const [question, setQuestion] = useState<string | null>(null);
  const [exitHint, setExitHint] = useState(false);

  const shown = useRef<string[]>([]);
  const attempts = useRef(0);
  /** いま出ている問いを、一度入れ替えたか（A2 は1回だけ） */
  const swapped = useRef(false);
  const charsAtLastQuestion = useRef<number | null>(null);
  const lastBody = useRef(body);
  /** タイマーから読む最新の本文（描画中には書き換えない） */
  const bodyRef = useRef(body);

  const idleTimer = useRef<number | null>(null);
  const stuckTimer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const onStuckRef = useRef<() => void>(() => {});

  const clearTimers = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    if (stuckTimer.current) window.clearTimeout(stuckTimer.current);
    idleTimer.current = null;
    stuckTimer.current = null;
  }, []);

  /** 問いを1つ頼む。出せたら true。検査落ち・通信失敗は黙って false */
  const ask = useCallback(async (): Promise<boolean> => {
    if (attempts.current >= ASK_MAX_ATTEMPTS || shown.current.length >= ASK_MAX_SHOWN) return false;
    attempts.current += 1;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      const res = await fetch("/api/survey/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // ★・話題タグ・店名は渡さない。本文と、直前に出した問いだけ
        body: JSON.stringify({ body: bodyRef.current.trim(), avoid: shown.current.slice(-3) }),
        signal: c.signal,
      });
      const data = (await res.json()) as { question?: string | null };
      if (c.signal.aborted || !data.question) return false;
      shown.current = [...shown.current, data.question];
      charsAtLastQuestion.current = charCount(bodyRef.current);
      setQuestion(data.question);
      return true;
    } catch {
      return false;
    }
  }, []);

  const scheduleStuck = useCallback(() => {
    if (stuckTimer.current) window.clearTimeout(stuckTimer.current);
    stuckTimer.current = window.setTimeout(() => onStuckRef.current(), ASK_STUCK_MS);
  }, []);

  /** 問いを出したあと、何も打たずに止まっている（A2） */
  const onStuck = useCallback(async () => {
    if (!swapped.current && shown.current.length < ASK_MAX_SHOWN && attempts.current < ASK_MAX_ATTEMPTS) {
      swapped.current = true;
      // 別の角度の問い。いま出ている問いは avoid に入っているので、同じ問いは検査で落ちる
      if (await ask()) {
        scheduleStuck();
        return;
      }
    }
    setExitHint(true);
  }, [ask, scheduleStuck]);

  useEffect(() => {
    onStuckRef.current = onStuck;
  }, [onStuck]);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    const bodyChanged = body !== lastBody.current;
    lastBody.current = body;
    if (bodyChanged) {
      // 打ち始めたら問いは消す。入れ替え（A2）と「ここまでで投稿できます」も最初から
      clearTimers();
      controller.current?.abort();
      swapped.current = false;
      setExitHint(false);
      if (question) {
        setQuestion(null);
        return;
      }
    }

    if (!active || paused) {
      clearTimers();
      controller.current?.abort();
      if (question && paused) setQuestion(null);
      return;
    }
    if (composing || question) return;

    const chars = charCount(body);
    if (chars < ASK_MIN_CHARS || chars >= ASK_STOP_CHARS) return;
    if (shown.current.length >= ASK_MAX_SHOWN || attempts.current >= ASK_MAX_ATTEMPTS) return;
    if (charsAtLastQuestion.current !== null && chars - charsAtLastQuestion.current < ASK_GAP_CHARS) return;

    idleTimer.current = window.setTimeout(async () => {
      if (await ask()) scheduleStuck();
    }, ASK_IDLE_MS);
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [body, composing, active, paused, question, ask, clearTimers, scheduleStuck]);

  // 画面を離れるときにタイマーと通信を後片付けする
  useEffect(
    () => () => {
      clearTimers();
      controller.current?.abort();
    },
    [clearTimers],
  );

  return { question, exitHint };
}
