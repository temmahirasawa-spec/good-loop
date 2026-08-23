"use client";

import { usePathname, useRouter } from "next/navigation";
import { AdminMobileTopBar } from "@/components/admin/AdminMobileNav";
import { PeriodPicker } from "@/components/admin/PeriodPicker";
import type { PeriodValue } from "@/lib/admin/period";
import { ResponseCard } from "@/components/admin/ResponseCard";
import type { ResponseItem } from "@/lib/admin/types";

type StoreOption = { id: string; name: string };
type Filters = {
  store: string;
  branch: "good" | "improve" | "all";
  /** 期間。プリセットか、任意の期間（YYYY-MM-DD）のどちらか */
  period: PeriodValue;
};

/** 見た目は据え置きのまま、実際のvalueを持つセレクト（矢印は自前で描き、ブラウザ既定の矢印は消す） */
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  widthClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  widthClassName: string;
}) {
  return (
    <div
      className={`relative flex h-11 flex-1 items-center rounded-xl border pl-4 pr-3 md:flex-none ${widthClassName}`}
      style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-surface-white)" }}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-[13px] outline-none"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="pointer-events-none absolute right-3 text-[11px]" style={{ color: "var(--product-color-text-secondary)" }}>
        ▾
      </p>
    </div>
  );
}

/**
 * Dashboard / 回答一覧（Figma node 51:883 PC / 52:899 SP）の表示部分。
 * データ取得・フィルタ適用は親（app/admin/(dashboard)/responses/page.tsx）が行う。
 *
 * フィルター（店舗・評価・分岐）・期間はURLのsearchParamsで状態を持つ（launch-plan.md D-8）。
 */
export function ResponsesView({
  responses,
  storeOptions,
  filters,
}: {
  responses: ResponseItem[];
  storeOptions: StoreOption[];
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function updateFilters(next: Partial<Filters>) {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams();
    if (merged.store) params.set("store", merged.store);
    if (merged.branch !== "all") params.set("branch", merged.branch);
    if ("preset" in merged.period) {
      if (merged.period.preset !== "7d") params.set("period", merged.period.preset);
    } else {
      params.set("from", merged.period.from);
      params.set("to", merged.period.to);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  /*
    絞り込みの形（2026-08-23、Figmaコメント 1895840397 / 1895840424）。
      店舗 … 下線でアクティブを示すタブ（よく切り替えるものなので1タップ）
      分岐 … ドロップダウン（たまにしか使わないので畳んでおく）
    以前は店舗がドロップダウン・分岐がタブだったが、使う頻度に合わせて役割を入れ替えた。
  */
  const storeTabs = (
    <div className="flex w-full shrink-0 items-start gap-1 overflow-x-auto pr-6 md:pr-0">
      {[{ id: "", name: "すべて" }, ...storeOptions].map((s) => {
        const selected = s.id === filters.store;
        return (
          <button
            key={s.id || "all"}
            type="button"
            onClick={() => updateFilters({ store: s.id })}
            aria-pressed={selected}
            className="flex min-h-[44px] shrink-0 items-center px-4"
            style={{ borderBottom: selected ? "2px solid var(--loop-accent-action)" : "2px solid transparent" }}
          >
            <span
              className="whitespace-nowrap text-xs"
              style={{
                color: selected ? "var(--loop-accent-action)" : "var(--product-color-text-secondary)",
                fontWeight: selected ? 700 : 400,
              }}
            >
              {s.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  const countLabel = `${responses.length}件の回答`;

  return (
    <>
      <AdminMobileTopBar title="回答一覧" />

      <div
        className="hidden w-full shrink-0 items-center justify-between rounded-2xl px-6 py-5 md:flex"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-xl font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          回答一覧
        </p>
        <div className="flex items-center gap-4">
          <p className="whitespace-nowrap text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {countLabel}
          </p>
          <PeriodPicker value={filters.period} onChange={(period) => updateFilters({ period })} />
        </div>
      </div>
      <p className="whitespace-nowrap text-[13px] font-medium md:hidden" style={{ color: "var(--product-color-text-secondary)" }}>
        {countLabel}
      </p>

      {storeTabs}
      <div className="flex w-full shrink-0 items-center gap-3">
        <FilterSelect
          value={filters.branch === "all" ? "" : filters.branch}
          onChange={(v) => updateFilters({ branch: (v || "all") as Filters["branch"] })}
          placeholder="すべての評価"
          widthClassName="md:w-[160px]"
          options={[
            { value: "good", label: "★5・4" },
            { value: "improve", label: "★3・2・1" },
          ]}
        />
        <div className="md:hidden">
          <PeriodPicker value={filters.period} onChange={(period) => updateFilters({ period })} />
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-3">
        {responses.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--product-color-text-tertiary)" }}>
            まだ回答がありません
          </p>
        ) : (
          responses.map((r) => <ResponseCard key={r.id} response={r} />)
        )}
      </div>
    </>
  );
}
