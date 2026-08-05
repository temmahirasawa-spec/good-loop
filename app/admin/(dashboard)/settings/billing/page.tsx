import { LoopButton } from "@/components/rating-flow/Button";

const INVOICES = [
  { month: "2026年7月", amount: "9,800円" },
  { month: "2026年6月", amount: "9,800円" },
  { month: "2026年5月", amount: "9,800円" },
];

/**
 * 設定（お支払い） Figma node 73:1399 PC / 75:1862 SP。
 *
 * Stripeがまだ未接続（docs/setup-tasks.md 7参照。料金体系の金額も8/6のMTG待ち）のため、
 * プラン変更・支払い方法変更・領収書ダウンロードの各リンクは見た目のみで動作しない。
 */
export default function SettingsBillingPage() {
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        お支払い
      </p>

      <div className="flex h-12 w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="w-[140px] text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            プラン
          </p>
          <p className="whitespace-nowrap text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
            スタンダード（月額 9,800円）
          </p>
        </div>
        <p className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
          プランを変更
        </p>
      </div>

      <div className="flex h-12 w-full items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="w-[140px] text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            お支払い方法
          </p>
          <p className="whitespace-nowrap text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
            Visa •••• 6411
          </p>
        </div>
        <p className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--loop-accent-action)" }}>
          変更
        </p>
      </div>

      <p className="pt-2 text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        請求履歴
      </p>
      {INVOICES.map((inv) => (
        <div key={inv.month} className="flex h-11 w-full items-center justify-between border-b" style={{ borderColor: "var(--product-color-border-divider)" }}>
          <div className="flex items-center gap-4 text-[12.5px]">
            <p style={{ color: "var(--product-color-text-primary)" }}>{inv.month}</p>
            <p style={{ color: "var(--product-color-text-secondary)" }}>{inv.amount}</p>
          </div>
          <p className="text-xs" style={{ color: "var(--loop-accent-action)" }}>
            領収書をダウンロード
          </p>
        </div>
      ))}
      <LoopButton variant="primary">請求履歴をすべて見る</LoopButton>
    </div>
  );
}
