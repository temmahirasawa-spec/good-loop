"use client";

import { useEffect, useRef, useState } from "react";
import { AskError, doneResult, errorResult, requestAsk, type AskFailure } from "@/lib/ai-check/api";
import { buildQuestions, normalizeInput } from "@/lib/ai-check/questions";
import { buildReport } from "@/lib/ai-check/report";
import type { CheckInput, CheckQuestion, CheckReport, QuestionResult } from "@/lib/ai-check/types";
import { AiCheckFooter } from "./AiCheckFooter";
import { AiCheckHeader } from "./AiCheckHeader";
import { CheckingScreen, type FailureNotice } from "./CheckingScreen";
import { InputScreen } from "./InputScreen";
import type { RowPhase } from "./QuestionProgressRow";
import { ReportScreen } from "./ReportScreen";
import { Toast } from "./Toast";
import { usePrefersReducedMotion } from "./hooks";

/**
 * AI視認性チェッカーの3画面をまとめる状態機械
 * （docs/plans/ai-visibility-checker.md 5章）。
 *
 * 質問の数だけ POST /api/checker/ask を**並列に**呼び、返ってきた順に行を確定させる。
 * 1問が落ちても他の問でレポートを出す。全問落ちたときだけ、入力に戻る導線を出す。
 *
 * 状態は React の state だけで持つ（localStorage / sessionStorage は使わない）。
 */

type Phase = "input" | "checking" | "report";

type Row = {
  phase: RowPhase;
  /** 経過秒数の起点。未開始なら null */
  startedAt: number | null;
  result: QuestionResult | null;
};

const EMPTY_INPUT: CheckInput = { storeName: "", area: "", genre: "" };

/**
 * 1問あたりの最短表示時間。
 * キャッシュに当たると応答が一瞬で返るが、計測している実感が無いと不自然なので、
 * 画面側で最低限の時間だけ待つ。**サーバー側では待たない**（関数の実行時間＝費用のため）。
 */
const MIN_ROW_DURATION_MS = 2000;
/** 問ごとに少しずつずらして、1行ずつ確定していく感じを保つ */
const ROW_STAGGER_MS = 600;

const FAILURE_NOTICES: Record<AskFailure, FailureNotice> = {
  rate_limited_ip: {
    title: "ただいま混み合っています",
    body: "無料でお使いいただくため、一定時間内のご利用回数に上限を設けています。お手数ですが、1時間ほど時間をおいてからもう一度お試しください。",
  },
  rate_limited_global: {
    title: "本日の受付を終了しました",
    body: "たいへん多くの方にご利用いただいており、本日ぶんの受付を終了しました。明日また、お試しいただけます。",
  },
  unavailable: {
    title: "ただいまご利用いただけません",
    body: "一時的に受け付けができない状態です。しばらく時間をおいてから、もう一度お試しください。",
  },
  failed: {
    title: "AIから回答を取得できませんでした",
    body: "AIの混雑や通信の問題が考えられます。しばらく待ってから、もう一度お試しください。",
  },
};

/** 混ざったときは、利用者に伝えるべき度合いが高いものを優先する */
const FAILURE_PRIORITY: AskFailure[] = [
  "rate_limited_global",
  "rate_limited_ip",
  "unavailable",
  "failed",
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 早く終わっても最短時間までは待つ。失敗したときも同じだけ待ってから投げ直す */
async function withMinDuration<T>(task: Promise<T>, ms: number): Promise<T> {
  const startedAt = Date.now();
  try {
    return await task;
  } finally {
    const remaining = ms - (Date.now() - startedAt);
    if (remaining > 0) await delay(remaining);
  }
}

export function AiCheckFlow() {
  const reduced = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState<CheckInput>(EMPTY_INPUT);
  const [questions, setQuestions] = useState<CheckQuestion[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [report, setReport] = useState<CheckReport | null>(null);
  const [failure, setFailure] = useState<FailureNotice | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /** 経過秒数の表示を更新するための現在時刻。診断中だけ1秒ごとに進む */
  const [now, setNow] = useState(0);
  /** 「入力に戻る」で捨てた古い実行の結果が、あとから state を上書きしないようにする */
  const runIdRef = useRef(0);

  // ── トーストの自動消去 ──────────────────────────
  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── 画面が切り替わったら先頭へ戻す ───────────────
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [phase, reduced]);

  // ── 経過秒数の更新（診断中だけ動かす）────────────
  useEffect(() => {
    if (phase !== "checking") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  async function startCheck() {
    const normalized = normalizeInput(input);
    if (normalized.storeName === "") {
      setToast("店名を入力してください");
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    const nextQuestions = buildQuestions(normalized);
    const startedAt = Date.now();

    setQuestions(nextQuestions);
    setRows(nextQuestions.map(() => ({ phase: "asking", startedAt, result: null })));
    setReport(null);
    setFailure(null);
    setNow(startedAt);
    setPhase("checking");

    const failures: AskFailure[] = [];

    const settled = await Promise.all(
      nextQuestions.map(async (question) => {
        const minDuration = MIN_ROW_DURATION_MS + question.index * ROW_STAGGER_MS;

        let result: QuestionResult;
        try {
          const answer = await withMinDuration(
            requestAsk(question.text, normalized.storeName),
            minDuration
          );
          result = doneResult(question, answer);
        } catch (error) {
          failures.push(error instanceof AskError ? error.failure : "failed");
          result = errorResult(question);
        }

        // 「入力に戻る」で別の実行が始まっていたら、この結果はもう表示しない
        if (runIdRef.current === runId) {
          setRows((current) =>
            current.map((row, i) => (i === question.index ? { ...row, phase: "done", result } : row))
          );
        }
        return result;
      })
    );

    if (runIdRef.current !== runId) return;

    if (settled.every((result) => result.status === "error")) {
      const worst = FAILURE_PRIORITY.find((kind) => failures.includes(kind)) ?? "failed";
      setFailure(FAILURE_NOTICES[worst]);
      return;
    }

    setReport(buildReport(normalized, settled, new Date().toISOString()));
    setPhase("report");
  }

  function restart() {
    runIdRef.current += 1;
    setQuestions([]);
    setRows([]);
    setReport(null);
    setFailure(null);
    setPhase("input");
  }

  function submitLead(email: string) {
    if (email === "") {
      setToast("メールアドレスを入力してください");
      return;
    }
    // POST /api/checker/leads はフェーズ4で実装する
    setToast("受け付けました（保存はこれから実装します）");
  }

  const elapsedSeconds = rows.map((row) =>
    row.phase === "asking" && row.startedAt !== null
      ? Math.max(0, Math.floor((now - row.startedAt) / 1000))
      : 0
  );

  return (
    <div className="flex min-h-dvh w-full flex-col" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <div className="mx-auto w-full max-w-[760px] flex-1 px-[var(--product-space-20)]">
        <AiCheckHeader />

        <main>
          {phase === "input" && <InputScreen value={input} onChange={setInput} onSubmit={startCheck} />}

          {phase === "checking" && (
            <CheckingScreen
              questions={questions}
              phases={rows.map((row) => row.phase)}
              results={rows.map((row) => row.result ?? undefined)}
              elapsedSeconds={elapsedSeconds}
              failure={failure}
              onRestart={restart}
              reducedMotion={reduced}
            />
          )}

          {phase === "report" && report !== null && (
            <ReportScreen
              report={report}
              onRestart={restart}
              onSubmitLead={submitLead}
              onNotify={setToast}
            />
          )}
        </main>

        <AiCheckFooter />
      </div>

      <Toast message={toast ?? ""} shown={toast !== null} />
    </div>
  );
}
