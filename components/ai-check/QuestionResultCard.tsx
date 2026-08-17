import type { ReactNode } from "react";
import { isTargetStore } from "@/lib/ai-check/match";
import type { QuestionResult } from "@/lib/ai-check/types";
import { EngineChip, Pill } from "./Pill";

/**
 * 質問別の結果カード（docs/prototypes/ai-visibility-checker.html の .qcard）。
 * 回答の抜粋の中で、自店の名前だけをマーカーで塗る。
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 抜粋の中の自店名をハイライトする */
function highlight(text: string, names: string[]): ReactNode[] {
  const targets = Array.from(new Set(names.filter((name) => name.trim() !== ""))).sort(
    (a, b) => b.length - a.length
  );
  if (targets.length === 0) return [text];

  const pattern = new RegExp(`(${targets.map(escapeRegExp).join("|")})`, "g");

  return text.split(pattern).map((part, i) =>
    targets.includes(part) ? (
      <mark
        key={i}
        className="font-bold"
        style={{ backgroundColor: "var(--loop-accent-light)", color: "var(--product-color-text-primary)" }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function QuestionResultCard({ result, store }: { result: QuestionResult; store: string }) {
  const failed = result.status === "error";

  return (
    <div
      className="mb-[var(--product-space-8)] rounded-[var(--product-radius-md)] border border-solid p-[var(--product-space-16)]"
      style={{
        backgroundColor: "var(--product-color-bg-primary)",
        borderColor: "var(--product-color-border-default)",
      }}
    >
      <div className="flex items-start justify-between gap-[var(--product-space-8)]">
        <p className="text-[14.5px] font-bold leading-[1.55]" style={{ color: "var(--product-color-text-primary)" }}>
          「{result.question}」
          <span className="ml-[var(--product-space-8)] align-[1px]">
            <EngineChip>{result.engine}</EngineChip>
          </span>
        </p>

        {failed ? (
          <Pill tone="muted">取得失敗</Pill>
        ) : result.mentioned ? (
          <Pill tone="accent">✓ {result.position ? `${result.position}位で登場` : "登場"}</Pill>
        ) : (
          <Pill tone="muted">✗ 登場せず</Pill>
        )}
      </div>

      {result.excerpt !== "" && (
        <p
          className="mt-[var(--product-space-8)] whitespace-pre-line rounded-r-[var(--product-radius-md)] border-l-[3px] border-solid py-[var(--product-space-12)] pl-[var(--product-space-12)] pr-[var(--product-space-12)] text-[13px] leading-[1.9]"
          style={{
            backgroundColor: "var(--product-color-bg-secondary)",
            borderColor: "var(--product-color-border-default)",
            color: "var(--product-color-text-secondary)",
          }}
        >
          {highlight(result.excerpt, [store, result.matchedText ?? ""])}
        </p>
      )}

      {result.stores.length > 0 && (
        <div className="mt-[var(--product-space-8)] flex flex-wrap gap-[var(--product-space-4)]">
          {result.stores.map((name, i) => {
            const isTarget = isTargetStore(name, store);
            return (
              <span
                key={`${name}-${i}`}
                className="rounded-[var(--product-radius-full)] border border-solid px-[var(--product-space-8)] py-[var(--product-space-2)] text-[11.5px]"
                style={
                  isTarget
                    ? {
                        backgroundColor: "var(--loop-accent-wash)",
                        borderColor: "var(--loop-accent-primary)",
                        color: "var(--loop-accent-action)",
                        fontWeight: 700,
                      }
                    : {
                        backgroundColor: "var(--product-color-surface-white)",
                        borderColor: "var(--product-color-border-default)",
                        color: "var(--product-color-text-secondary)",
                        fontWeight: 500,
                      }
                }
              >
                {name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
