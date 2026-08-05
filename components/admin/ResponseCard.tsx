import type { ResponseItem } from "@/lib/admin/mock-data";

/** Response カード（Figma node 51:921 等）— 回答一覧・店舗詳細の「直近の回答」で共有 */
export function ResponseCard({ response, showStoreName = true }: { response: ResponseItem; showStoreName?: boolean }) {
  const lowRating = response.rating <= 2;
  const ratingColor = lowRating ? "var(--product-color-status-warning)" : "var(--loop-accent-primary)";

  return (
    <div
      className="flex w-full flex-col items-start gap-3 rounded-2xl px-6 py-5"
      style={{
        backgroundColor: "var(--product-color-surface-white)",
        borderWidth: lowRating ? 1.5 : 0,
        borderStyle: "solid",
        borderColor: "var(--product-color-status-warning)",
      }}
    >
      <div className="flex w-full flex-col items-start gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <p className="whitespace-nowrap text-[14px] font-bold md:text-[15px]" style={{ color: ratingColor }}>
            {"★".repeat(response.rating)}
            {"☆".repeat(5 - response.rating)}
          </p>
          {showStoreName && (
            <p className="whitespace-nowrap text-[13px] font-bold md:text-sm" style={{ color: "var(--product-color-text-primary)" }}>
              {response.storeName}
            </p>
          )}
          <p className="whitespace-nowrap text-[11px] font-medium md:text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
            {response.dateLabel}
          </p>
        </div>
        <div
          className="flex w-fit items-start rounded-full px-3 py-1"
          style={{
            backgroundColor: response.routeStatus === "guided" ? "var(--loop-accent-wash)" : "var(--product-color-bg-primary)",
          }}
        >
          <p
            className="whitespace-nowrap text-[10.5px] font-medium md:text-[11px]"
            style={{ color: response.routeStatus === "guided" ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)" }}
          >
            {response.routeStatus === "guided" ? "Googleへ誘導済み" : "店舗にのみ共有"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {response.tags.map((tag) => (
          <div key={tag} className="flex items-start rounded-lg px-2 py-1 md:px-3" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
            <p className="whitespace-nowrap text-[11px] font-medium md:text-xs" style={{ color: "var(--product-color-text-secondary)" }}>
              {tag}
            </p>
          </div>
        ))}
      </div>
      {response.freeText && (
        <p className="text-[13.5px] font-medium leading-[23px]" style={{ color: "var(--product-color-text-primary)" }}>
          「{response.freeText}」
        </p>
      )}
    </div>
  );
}
