"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LoopSelect } from "@/components/admin/LoopSelect";

/**
 * 設定画面の店舗切り替え（2026-08-21 新設）。
 *
 * アンケート項目・ブランドとテーマは**店舗ごと**の設定なので、どの店舗を編集しているのかを
 * 常に見えるようにする。選択状態はURL（`?store=<店舗ID>`）で持つため、
 * リロードしても・タブを行き来しても同じ店舗のままになる。
 *
 * **4店舗まではタブ、5店舗以上はドロップダウン**に切り替える
 * （2026-08-22 天真決定、docs/ui-review.md Q7）。タブは一覧性が高いが、
 * 数が増えると画面外へ流れてしまう（設定タブがSPで45%見切れていたのと同じ問題）。
 *
 * ただし**スマホでは店舗数によらず常にドロップダウン**にする。390pxの幅では、
 * 「YORKYS BRUNCH 夙川店」のような長い店舗名だと3店舗でも右端が切れてしまうことを
 * 実機で確認したため（2026-08-22）。同じ理由で、幅ではなく数だけで切り替える判定は
 * PCにだけ効かせている。
 *
 * タブの見た目は既存の `Loop / Segment Chip`（Figma node 39:816、期間フィルターと同じピル）に
 * そろえる。生のスタイルを起こさず既存のデザインを写し取る（docs/specs/design-rules.md 2-3）。
 * 店舗が1つしか無いテナントでは、選ぶものが無いので何も描画しない。
 */

/** ここを超えたらドロップダウンに切り替える */
const TAB_LIMIT = 4;

export function StoreSwitchTabs({ stores, selectedId }: { stores: { id: string; name: string }[]; selectedId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  if (stores.length < 2) return null;

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        設定する店舗
      </p>
      {/* スマホは常にドロップダウン。PCで5店舗以上のときも同じものを使う */}
      <LoopSelect
        ariaLabel="設定する店舗を選ぶ"
        value={selectedId}
        onChange={(id) => router.push(`${pathname}?store=${id}`)}
        options={stores.map((s) => ({ value: s.id, label: s.name }))}
        className={stores.length > TAB_LIMIT ? "w-full md:w-[280px]" : "w-full md:hidden"}
      />
      {stores.length <= TAB_LIMIT && (
        <div className="hidden w-full items-start gap-1 overflow-x-auto md:flex">
          {stores.map((store) => {
            const selected = store.id === selectedId;
            return (
              <Link
                key={store.id}
                href={`${pathname}?store=${store.id}`}
                scroll={false}
                className="flex min-h-[44px] shrink-0 items-center rounded-full px-5 py-[13px]"
                style={{ backgroundColor: selected ? "var(--loop-accent-primary)" : "transparent" }}
              >
                <span
                  className="whitespace-nowrap text-xs font-medium"
                  style={{ color: selected ? "var(--loop-accent-on-primary)" : "var(--product-color-text-secondary)" }}
                >
                  {store.name}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
