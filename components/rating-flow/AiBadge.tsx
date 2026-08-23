import { AiSparkleIcon } from "./icons";

/** Review / AI Badge（Figma node 1:622）— AI生成であることを開示するバッジ。下書き提示画面には必ず置く */
export function AiBadge({ label }: { label: string }) {
  return (
    <div
      className="flex shrink-0 items-center gap-[var(--product-space-4)] rounded-[var(--product-radius-full)] px-[var(--product-space-12)] py-[var(--product-space-8)]"
      style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}
    >
      <AiSparkleIcon className="size-[15px] shrink-0" />
      <span className="whitespace-nowrap text-[11px] font-medium tracking-[0.22px]">{label}</span>
    </div>
  );
}
