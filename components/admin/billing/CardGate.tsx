"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { BillingIcon } from "@/components/admin/SettingsMenuIcons";
import { BILLING, formatYen, monthlyQuoteFor } from "@/lib/admin/constants";
import { formatMonthDay, TRIAL_DAYS } from "@/lib/billing/trial";

/**
 * カードの関門（無料体験 A案「帯とモーダル」。Figma App Design Master `12 無料体験 / Trial`）。
 *
 * 二次元コード・卓上POP・店舗枠の追加など「お店で使う」操作の手前で出す（docs/specs/billing.md §3-2）。
 * **押した場所の上に重ねて出す**（PC はモーダル、スマホは下からのシート）。
 *
 * | 状態 | 中身 |
 * |---|---|
 * | gate | 「カードを登録して、無料体験を始める」。料金・無料の期間・解約・1回かぎり |
 * | paid | 前に無料体験をしていた（メール・お店・カード）。理由と今日の金額 →「有料で始める／やめる」 |
 *
 * **黙って請求しない。** 「有料で始める」を押したときだけ、請求のある画面へ進む。
 * 判定はサーバー（/api/admin/billing/checkout）がやり直す。ここは結果を見せるだけ。
 */

type Reason = "place" | "card" | "email";
type Quote = { excludingTax: number; includingTax: number };
type Mode = { kind: "gate" } | { kind: "paid"; reason: Reason; quote: Quote | null; via: "checkout" | "start-paid" };

type GateValue = {
  /** カードの登録が要るか（申し込みから来て契約が無い、またはお休み） */
  needsCard: boolean;
  /** お休みか（もう一度カードを登録すると再開。体験は付かない） */
  paused: boolean;
  /** 操作の手前で呼ぶ。カードが要るなら関門を出し、要らなければそのまま操作を行う */
  requireCard: (onAllowed?: () => void) => void;
  /** カードの登録を始める（お休みからの再開・設定＞お支払いのボタン） */
  startRegistration: () => void;
  /** カードで対象外だった（Stripe から戻ったあと）。「有料で始める」の確認を出す */
  openPaidConfirmation: (reason: Reason) => void;
  /** 関門の中身をすでに見せている画面（オンボーディング7）から、そのまま Stripe の画面へ進む */
  beginCheckout: () => void;
};

const Ctx = createContext<GateValue | null>(null);

export function useCardGate(): GateValue {
  const v = useContext(Ctx);
  // 関門の外（オンボーディングなど）では、いつでも通す
  return v ?? { needsCard: false, paused: false, requireCard: (f) => f?.(), startRegistration: () => {}, openPaidConfirmation: () => {}, beginCheckout: () => {} };
}

export function CardGateProvider({
  needsCard,
  paused,
  quota,
  children,
}: {
  needsCard: boolean;
  paused: boolean;
  /** 契約の数量（店舗枠）。料金の明細に使う */
  quota: number;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    if (busy) return;
    setMode(null);
    setError(null);
  }, [busy]);

  /** Stripe の画面へ。体験ありなら setup モード、「有料で始める」なら subscription モード（サーバーが決める） */
  const checkout = useCallback(async (paid: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid, returnTo: window.location.pathname + window.location.search }),
      });
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string; needsPaidConfirmation?: boolean; reason?: Reason; quote?: Quote }
        | null;
      if (res.ok && data?.url) {
        window.location.href = data.url;
        return; // 遷移するので busy は戻さない
      }
      if (res.status === 409 && data?.needsPaidConfirmation && data.reason) {
        setMode({ kind: "paid", reason: data.reason, quote: data.quote ?? null, via: "checkout" });
      } else {
        setMode((m) => m ?? { kind: "gate" });
        setError(data?.error ?? "お支払いの画面を開けませんでした。もう一度お試しください。");
      }
    } catch {
      setMode((m) => m ?? { kind: "gate" });
      setError("お支払いの画面を開けませんでした。もう一度お試しください。");
    }
    setBusy(false);
  }, []);

  /** カードは預かり済み。体験なしで契約を作り、今日の分を請求する */
  const startPaid = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/billing/start-paid", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; invoiceUrl?: string; error?: string } | null;
      if (res.ok && data?.invoiceUrl) {
        // カードの会社が本人確認を求めた。Stripe の請求書の画面で済ませてもらう
        window.location.href = data.invoiceUrl;
        return;
      }
      if (res.ok) {
        window.location.href = "/admin/settings/billing";
        return;
      }
      setError(data?.error ?? "お支払いに失敗しました。カードの状態をご確認ください。");
    } catch {
      setError("お支払いに失敗しました。カードの状態をご確認ください。");
    }
    setBusy(false);
  }, []);

  const value = useMemo<GateValue>(
    () => ({
      needsCard,
      paused,
      requireCard: (onAllowed) => {
        if (!needsCard) return onAllowed?.();
        // お休みからの再開は体験が付かない。体験の案内は出さず、そのまま判定へ進む
        if (paused) return void checkout(false);
        setMode({ kind: "gate" });
      },
      startRegistration: () => (paused ? void checkout(false) : setMode({ kind: "gate" })),
      openPaidConfirmation: (reason) => setMode({ kind: "paid", reason, quote: null, via: "start-paid" }),
      beginCheckout: () => void checkout(false),
    }),
    [needsCard, paused, checkout],
  );

  const fallbackQuote = monthlyQuoteFor(quota);
  return (
    <Ctx.Provider value={value}>
      {children}
      {mode && (
        <GateModal
          mode={mode}
          quota={quota}
          quote={mode.kind === "paid" && mode.quote ? mode.quote : fallbackQuote}
          busy={busy}
          error={error}
          onClose={close}
          onRegister={() => void checkout(false)}
          onStartPaid={() => (mode.kind === "paid" && mode.via === "start-paid" ? void startPaid() : void checkout(true))}
        />
      )}
    </Ctx.Provider>
  );
}

const REASON_HEAD: Record<Reason, string> = {
  place: "このお店では、以前に無料体験をご利用いただいています",
  card: "このカードでは、以前に無料体験をご利用いただいています",
  email: "このメールアドレスでは、以前に無料体験をご利用いただいています",
};

function GateModal({
  mode,
  quota,
  quote,
  busy,
  error,
  onClose,
  onRegister,
  onStartPaid,
}: {
  mode: Mode;
  quota: number;
  quote: Quote;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onRegister: () => void;
  onStartPaid: () => void;
}) {
  const paid = mode.kind === "paid";

  return (
    // スクリム（背景の暗幕）は他のモーダル（AddStoreModal・店舗枠の確認）とそろえる
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-gate-title"
        className="flex max-h-[90dvh] w-full flex-col items-start gap-4 overflow-y-auto rounded-t-[20px] px-6 pb-8 pt-3 md:w-[560px] md:gap-5 md:rounded-2xl md:p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)", boxShadow: "0px 8px 32px 0px rgba(0,0,0,0.14)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-4 w-full items-center justify-center md:hidden">
          <span className="block h-1 w-10 rounded-full" style={{ backgroundColor: "var(--product-color-border-default)" }} />
        </div>

        <div className="flex w-full items-center gap-3">
          <span className="shrink-0">
            <BillingIcon />
          </span>
          <h2 id="card-gate-title" className="text-base font-bold leading-snug md:text-xl" style={{ color: "var(--product-color-text-primary)" }}>
            {paid ? REASON_HEAD[mode.reason] : "カードを登録して、無料体験を始める"}
          </h2>
        </div>

        <p className="text-xs leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
          {paid
            ? `今日から有料でのご利用になります。今日のお支払いは${formatYen(quote.excludingTax)}（税抜）です（税込 ${formatYen(quote.includingTax)}）。`
            : "二次元コードの発行と店舗の追加は、お支払いのカードを登録してからお使いいただけます。14日間の無料体験は、登録した日から始まります。"}
        </p>

        <GateSummary quota={quota} quote={quote} paid={paid} />

        {error && (
          <p role="alert" className="text-[13px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
            {error}
          </p>
        )}

        <div className="flex w-full items-center justify-between gap-4 pt-2">
          <button type="button" onClick={onClose} className="min-h-11 text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            {paid ? "やめる" : "キャンセル"}
          </button>
          <div className="w-[200px] md:w-[240px]">
            <ReviewButton variant="primary" disabled={busy} onClick={paid ? onStartPaid : onRegister}>
              {busy ? "開いています..." : paid ? "有料で始める" : "カードを登録する"}
            </ReviewButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 関門の中身のうち、料金の明細・無料の期間・注意（モーダルとオンボーディング7で共通）。
 * 金額は店舗枠から見積もる（実際の請求額の正は Stripe。「有料で始める」の確認ではサーバーの見積もりを使う）。
 */
export function GateSummary({ quota, quote, paid = false }: { quota: number; quote?: Quote; paid?: boolean }) {
  const extra = Math.max(0, quota - BILLING.includedStores);
  const q = quote ?? monthlyQuoteFor(quota);
  // 無料の期間の終わり（カードを登録した日から14日。表示の見込み。実際の日付は Stripe が決める）
  const end = formatMonthDay(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000));
  return (
    <>
      <div className="flex w-full flex-col gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
        <Row label={`${BILLING.planLabel}（${BILLING.includedStores}店舗まで）`} value={formatYen(BILLING.planMonthlyYen)} />
        {extra > 0 && <Row label={`追加店舗 × ${extra}`} value={formatYen(extra * BILLING.additionalStoreMonthlyYen)} />}
        <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-sm font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {paid ? "今日のお支払い（税抜）" : `${end}からの月額（税抜）`}
          </p>
          <p className="text-xl font-bold tabular-nums" style={{ color: "var(--product-color-text-primary)" }}>
            {formatYen(q.excludingTax)}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs" style={{ color: "var(--product-color-text-tertiary)" }}>
            税込
          </p>
          <p className="text-xs tabular-nums" style={{ color: "var(--product-color-text-tertiary)" }}>
            {formatYen(q.includingTax)}
          </p>
        </div>
      </div>

      {!paid && (
        <>
          <p className="text-[13px] leading-[1.6]" style={{ color: "var(--product-color-text-primary)" }}>
            <span className="font-bold">今日から{end}まで無料です。</span>
            {end}から、月額{formatYen(q.excludingTax)}（税抜）のお支払いが始まります。
          </p>
          <ul className="flex w-full flex-col gap-2">
            {["体験中に解約すれば、料金はかかりません。体験の最終日までお使いいただけます。", "無料体験は、1つのお店・1枚のカードにつき1回です。"].map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
                <span className="font-bold" style={{ color: "var(--review-accent-primary)" }}>
                  ✓
                </span>
                {t}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>
      <p className="text-[13px] tabular-nums" style={{ color: "var(--product-color-text-secondary)" }}>
        {value}
      </p>
    </div>
  );
}
