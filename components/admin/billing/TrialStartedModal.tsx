"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { downloadQr } from "@/components/admin/QrCard";

/**
 * 登録の直後の案内（無料体験 A案。Figma App Design Master `12 無料体験 / Trial` の「登録の直後（印刷して置く案内）」）。
 *
 * カードを登録して Stripe の画面から戻ったとき（/admin?trial=started）に、トップの上に重ねて出す。
 * **今日置けば、14日間まるごと試せる**ので、印刷して置くところまで案内する（docs/specs/billing.md §3-5）。
 */
type Store = { id: string; name: string; slug: string; qrSvg: string | null };

const HOW_TO: [string, string][] = [
  ["印刷する", "「印刷用POPを作る」から、A6（105×148mm）で印刷します"],
  ["置く", "席やレジの横など、お客様の目に入る場所に置きます"],
  ["確かめる", "ご自身のスマホで読み取って、アンケートが開くか確かめます"],
];

export function TrialStartedModal({ stores, daysLeft, endLabel }: { stores: Store[]; daysLeft: number; endLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  function close() {
    setOpen(false);
    // 問い合わせの文字（?trial=started）を消す。ページは読み直さない
    router.replace("/admin", { scroll: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-started-title"
        className="flex max-h-[90dvh] w-full flex-col items-start gap-4 overflow-y-auto rounded-t-[20px] px-6 pb-8 pt-3 md:w-[640px] md:gap-5 md:rounded-2xl md:p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-4 w-full items-center justify-center md:hidden">
          <span className="block h-1 w-10 rounded-full" style={{ backgroundColor: "var(--product-color-border-default)" }} />
        </div>

        <div className="flex w-full flex-col items-start gap-2">
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}>
            無料体験 残り{daysLeft}日（{endLabel}まで）
          </span>
          <h2 id="trial-started-title" className="text-base font-bold md:text-xl" style={{ color: "var(--product-color-text-primary)" }}>
            今日置けば、14日間まるごと試せます
          </h2>
          <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
            印刷用のデータをダウンロードして、お店に置きましょう。
          </p>
        </div>

        <ul className="flex w-full flex-col">
          {stores.map((s, i) => (
            <li
              key={s.id}
              className="flex w-full items-center gap-3 py-3 md:gap-4"
              style={i > 0 ? { borderTop: "1px solid var(--product-color-border-divider)" } : undefined}
            >
              {s.qrSvg && (
                <div
                  className="size-12 shrink-0 overflow-hidden md:size-14 [&>svg]:size-full"
                  style={{ backgroundColor: "white" }}
                  // eslint-disable-next-line react/no-danger -- lib/qr-code.ts がサーバー側で生成した固定フォーマットのSVGで、外部入力を含まない
                  dangerouslySetInnerHTML={{ __html: s.qrSvg }}
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                  {s.name}
                </p>
                {s.qrSvg && (
                  <button type="button" onClick={() => downloadQr(s.qrSvg!, s.slug)} className="text-xs" style={{ color: "var(--review-accent-primary)" }}>
                    画像をダウンロード
                  </button>
                )}
              </div>
              <Link
                href={`/admin/settings/pop?store=${s.id}`}
                className="flex h-[52px] shrink-0 items-center justify-center rounded-lg px-4 text-sm font-bold md:h-11 md:w-[180px]"
                style={{ backgroundColor: "var(--review-accent-primary)", color: "var(--review-accent-on-primary)" }}
              >
                印刷用POPを作る
              </Link>
            </li>
          ))}
        </ul>

        <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />

        <div className="flex w-full flex-col gap-3">
          <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            置き方
          </p>
          <ol className="flex w-full flex-col gap-3">
            {HOW_TO.map(([title, text], i) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                    {title}
                  </p>
                  <p className="text-xs leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <button type="button" onClick={close} className="min-h-11 text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          閉じる
        </button>
      </div>
    </div>
  );
}
