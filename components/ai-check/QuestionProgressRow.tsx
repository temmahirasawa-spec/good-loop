import type { QuestionResult } from "@/lib/ai-check/types";
import { Card } from "./Card";
import { EngineChip } from "./Pill";

/**
 * 診断中画面の1行（docs/prototypes/ai-visibility-checker.html の .qrow）。
 *
 * ⚠ プロトタイプは「質問中 → 照合中 → 結果」の3段だったが、実装では2段にした。
 *   質問と照合を1つのAPI（POST /api/checker/ask）でまとめて行うため、
 *   ブラウザ側には「照合が始まった瞬間」が分からない。
 *   分からないものを表示するとただの嘘になるので、代わりに**経過秒数**を出している。
 *   3段に戻したい場合は ask と judge をエンドポイントごと分ける必要がある。
 */
export type RowPhase = "waiting" | "asking" | "done";

function statusText(
  phase: RowPhase,
  result: QuestionResult | undefined,
  elapsedSeconds: number
): string {
  if (phase === "waiting") return "待機中…";
  if (phase === "asking") return `AIに質問中…（Web検索 ${elapsedSeconds}秒）`;
  if (!result || result.status === "error") return "取得できませんでした";
  if (!result.mentioned) return "登場せず";

  const rank = result.position ? `${result.position}位で登場` : "登場";
  return result.stores.length > 0 ? `${rank}（${result.stores.length}店中）` : rank;
}

export function QuestionProgressRow({
  question,
  engine,
  phase,
  result,
  elapsedSeconds,
  reducedMotion,
}: {
  question: string;
  engine: string;
  phase: RowPhase;
  result: QuestionResult | undefined;
  elapsedSeconds: number;
  reducedMotion: boolean;
}) {
  const done = phase === "done";
  const failed = done && (result === undefined || result.status === "error");
  const mentioned = done && result !== undefined && result.status === "done" && result.mentioned;

  // 「登場した＝アクセント色 / 登場せず＝グレー」。既存トークンに赤も緑も無いため
  const markColor = mentioned ? "var(--loop-accent-primary)" : "var(--product-color-text-secondary)";

  return (
    <Card className="mb-[var(--product-space-8)] flex items-center gap-[var(--product-space-12)] p-[var(--product-space-16)]">
      <div className="flex size-[26px] shrink-0 items-center justify-center">
        {done ? (
          <span aria-hidden className="text-[15px] font-bold" style={{ color: markColor }}>
            {failed ? "—" : mentioned ? "✓" : "✗"}
          </span>
        ) : phase === "waiting" ? (
          <span
            aria-hidden
            className="size-[10px] rounded-[var(--product-radius-full)]"
            style={{ backgroundColor: "var(--product-color-border-default)" }}
          />
        ) : (
          <span
            aria-hidden
            className={`size-[16px] rounded-[var(--product-radius-full)] border-2 border-solid ${reducedMotion ? "" : "animate-spin"}`}
            style={{
              borderColor: "var(--product-color-border-default)",
              borderTopColor: "var(--product-color-text-primary)",
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-[1.5]" style={{ color: "var(--product-color-text-primary)" }}>
          「{question}」
        </p>
        <p
          className="mt-[var(--product-space-2)] text-xs"
          style={{
            color: done ? markColor : "var(--product-color-text-secondary)",
            fontWeight: done ? 700 : 500,
          }}
        >
          {statusText(phase, result, elapsedSeconds)}
        </p>
      </div>

      <div className="shrink-0">
        <EngineChip>{engine}</EngineChip>
      </div>
    </Card>
  );
}
