"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 設定画面の店舗切り替えタブ（2026-08-21 新設。天真が案1「上部に店舗タブ」を選択）。
 *
 * アンケート項目・ブランドとテーマは**店舗ごと**の設定なので、どの店舗を編集しているのかを
 * 常に見えるようにする。選択状態はURL（`?store=<店舗ID>`）で持つため、
 * リロードしても・タブを行き来しても同じ店舗のままになる。
 *
 * 店舗が1つしか無いテナントでは、選ぶものが無いので何も描画しない。
 */
export function StoreSwitchTabs({ stores, selectedId }: { stores: { id: string; name: string }[]; selectedId: string }) {
  const pathname = usePathname();
  if (stores.length < 2) return null;

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        設定する店舗
      </p>
      <div className="flex w-full items-start gap-2 overflow-x-auto">
        {stores.map((store) => {
          const selected = store.id === selectedId;
          return (
            <Link
              key={store.id}
              href={`${pathname}?store=${store.id}`}
              scroll={false}
              className="flex shrink-0 items-center rounded-full border px-4 py-2"
              style={{
                backgroundColor: selected ? "var(--loop-accent-wash)" : "var(--product-color-surface-white)",
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? "var(--loop-accent-primary)" : "var(--product-color-border-divider)",
              }}
            >
              <span
                className="whitespace-nowrap text-xs"
                style={{ color: "var(--product-color-text-primary)", fontWeight: selected ? 700 : 500 }}
              >
                {store.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
