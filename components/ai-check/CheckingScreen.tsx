import type { CheckQuestion, QuestionResult } from "@/lib/ai-check/types";
import { Card, Eyebrow } from "./Card";
import { GhostButton } from "./GhostButton";
import { QuestionProgressRow, type RowPhase } from "./QuestionProgressRow";

/**
 * 02 診断中画面（docs/prototypes/ai-visibility-checker.html の #scr-check）。
 *
 * 進捗バーは「確定した問数 ÷ 全問数」。既存の `ProgressBar`
 * （components/rating-flow/ProgressBar.tsx）は2ステップ固定のため使えない。
 *
 * 全問が失敗したときだけ、入力に戻れるバナーを出す。
 * 1問でも取れていればレポート画面へ進む（失敗した問はレポート側で明記する）。
 */
/** 全問が失敗したときに出す案内。責める調子にしないこと */
export type FailureNotice = { title: string; body: string };

export function CheckingScreen({
  questions,
  phases,
  results,
  elapsedSeconds,
  failure,
  onRestart,
  reducedMotion,
}: {
  questions: CheckQuestion[];
  phases: RowPhase[];
  /** 質問と同じ並び。まだ確定していない問は undefined */
  results: (QuestionResult | undefined)[];
  /** 各問の経過秒数 */
  elapsedSeconds: number[];
  /** 全問が失敗したときだけ入る。途中は null */
  failure: FailureNotice | null;
  onRestart: () => void;
  reducedMotion: boolean;
}) {
  const doneCount = phases.filter((phase) => phase === "done").length;
  const percent = questions.length === 0 ? 0 : Math.round((doneCount / questions.length) * 100);

  return (
    <div className="w-full pb-[var(--product-space-40)] pt-[var(--product-space-48)]">
      <Eyebrow>Checking</Eyebrow>

      <h2
        className="mt-[var(--product-space-8)] text-xl font-bold"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        {failure ? failure.title : "AIに質問しています…"}
      </h2>
      <p className="mt-[var(--product-space-4)] text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
        {failure
          ? "ご不便をおかけします。"
          : "実際にAIへ質問し、Web検索を伴う回答を待っています。少し時間がかかります。"}
      </p>

      <div
        className="my-[var(--product-space-20)] h-[6px] w-full overflow-hidden rounded-[var(--product-radius-full)]"
        style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="診断の進捗"
      >
        <div
          className="h-full rounded-[var(--product-radius-full)]"
          style={{
            width: `${percent}%`,
            backgroundColor: "var(--review-accent-primary)",
            transition: reducedMotion ? "none" : "width 0.5s ease",
          }}
        />
      </div>

      {/*
        支援技術への通知。行そのものを aria-live にすると、質問文まで毎回読み上げられて
        うるさいので、要点だけを読み上げる専用の領域を別に置いている。
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {failure
          ? `${failure.title}。${failure.body}`
          : `${questions.length}問中${doneCount}問が完了しました。`}
      </p>

      <div>
        {questions.map((question, i) => (
          <QuestionProgressRow
            key={question.index}
            question={question.text}
            engine={question.engine}
            phase={phases[i] ?? "waiting"}
            result={results[i]}
            elapsedSeconds={elapsedSeconds[i] ?? 0}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {failure && (
        <Card className="mt-[var(--product-space-16)] p-[var(--product-space-16)]">
          <p className="text-[13px] leading-[1.8]" style={{ color: "var(--product-color-text-secondary)" }}>
            {failure.body}
          </p>
          <div className="mt-[var(--product-space-12)]">
            <GhostButton onClick={onRestart}>入力に戻る</GhostButton>
          </div>
        </Card>
      )}
    </div>
  );
}
