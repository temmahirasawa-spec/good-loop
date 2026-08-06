"use client";

import { useRef, useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { LoopInput } from "@/components/admin/LoopInput";
import { LOOP_THEMES } from "@/lib/admin/constants";

/**
 * 設定（ブランドとテーマ） Figma node 69:1261 PC / 75:1613 SP。
 *
 * ロゴは選択したファイルをその場でプレビューするだけ（Supabase Storageが無いため保存はしない）。
 * ブランド名・テーマの選択も同様にローカル状態のみで、まだ保存APIには繋がっていない。
 */
export default function SettingsBrandPage() {
  const [brandName, setBrandName] = useState("YORKYS BRUNCH");
  const [theme, setTheme] = useState("restaurant");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUrl(URL.createObjectURL(file));
  }

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          ブランド
        </p>
        <div className="flex w-full items-center gap-4">
          <div
            className="flex size-24 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed"
            style={{ borderColor: "var(--product-color-border-default)", backgroundColor: "var(--product-color-bg-primary)" }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- ローカルのobject URLプレビューのため next/image は不要
              <img src={logoUrl} alt="アップロードしたロゴ" className="size-full object-cover" />
            ) : (
              <p className="text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
                ロゴ
              </p>
            )}
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
            <LoopButton variant="primary" onClick={() => fileInputRef.current?.click()}>
              ロゴをアップロード
            </LoopButton>
            <p className="text-xs font-medium" style={{ color: "var(--product-color-text-tertiary)" }}>
              推奨: 正方形・PNG（背景透過）。未設定の間はブランド名の文字がロゴの代わりに表示されます
            </p>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-2">
          <p className="text-xs font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            ブランド名
          </p>
          <LoopInput value={brandName} onChange={setBrandName} />
        </div>
      </div>

      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          テーマ
        </p>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          業態を選ぶと、色とアンケート項目のプリセットが切り替わります
        </p>
        <div className="flex w-full flex-col flex-wrap items-start gap-2 pt-1 md:flex-row">
          {LOOP_THEMES.map((t) => {
            const selected = t.slug === theme;
            return (
              <button
                key={t.slug}
                type="button"
                onClick={() => setTheme(t.slug)}
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 md:w-auto md:flex-1 md:flex-col md:px-2"
                style={{
                  backgroundColor: selected ? "var(--loop-accent-wash)" : "var(--product-color-surface-white)",
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? "var(--loop-accent-primary)" : "var(--product-color-border-divider)",
                }}
              >
                <div className="flex shrink-0 items-start gap-1">
                  <span className="block size-5 rounded-[6px]" style={{ backgroundColor: t.swatchPrimary }} />
                  <span className="block size-5 rounded-[6px] border" style={{ backgroundColor: t.swatchLight, borderColor: "rgba(0,0,0,0.06)" }} />
                </div>
                <span
                  className="whitespace-nowrap text-[13.5px] md:text-xs"
                  style={{
                    color: selected ? "var(--product-color-text-primary)" : "var(--product-color-text-secondary)",
                    fontWeight: selected ? 700 : 500,
                  }}
                >
                  {t.label}
                </span>
                {selected && (
                  <span className="ml-auto text-sm font-bold md:hidden" style={{ color: "var(--loop-accent-action)" }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
