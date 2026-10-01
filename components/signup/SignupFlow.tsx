"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { BILLING, formatYen } from "@/lib/admin/constants";
import { PASSWORD_PLACEHOLDER, PASSWORD_RULE_TEXT } from "@/lib/password";
import { TRIAL_DAYS } from "@/lib/billing/trial";
import { PricingSimulator } from "@/components/signup/PricingSimulator";
import { monthlyYenFor } from "@/lib/signup/plan";
import { INVITE_CODE_UNUSABLE, normalizeInviteCode } from "@/lib/signup/invite-code";

/**
 * 新規登録（Figma `11 新規登録 / Signup`。案C = 料金ページ＋申し込みカード）。
 *
 * 3つの段を1つの部品で持つ。**画面遷移を跨がないので、入力と選んだ店舗数が消えない。**
 *   料金 → アカウント作成 → お申し込み完了
 *
 * カードの登録はここでは求めない（14日間の無料トライアル）。
 * 支払いは期限までに 設定＞お支払い から行う（docs/specs/billing.md 5-2）。
 *
 * ── 招待コード（試験導入＝招待制ベータ。supabase/0018、2026-10-01）──────────
 * 料金の段（1つ目）に欄を置く。Figma に無い要素なので、アカウント作成の段と同じ入力欄（Field）を使う。
 *   - `inviteRequired`（SIGNUP_MODE=invite。未設定も含む）なら必須。open なら任意
 *   - 形（8文字か）は進む前にここで確かめる。使えるか（期限・回数）はサーバーだけが知っている
 *   - サーバーが「使えない」と返したら1つ目の段に戻し、欄の下に理由を出す。
 *     ほかの入力（会社名・メールなど）は同じ部品の中に残っているので消えない
 *   - 試験導入で登録できたら、完了画面に無料期間と月額の案内を出さない（無料のため）
 */

type Step = "pricing" | "account" | "done";

const FAQ = [
  ["契約期間の縛りはありますか？", "ありません。月ごとのご契約で、いつでも解約できます。"],
  ["無料期間だけ使ってやめられますか？", `できます。${TRIAL_DAYS}日以内に解約すれば費用は一切かかりません。`],
  [
    "店舗はあとから増やせますか？",
    "増やせます。管理画面の「お支払い」から店舗枠を追加すると、その月の差額だけを日割りでご請求します。",
  ],
  ["支払い方法は何が使えますか？", "クレジットカードのみです。"],
] as const;

export function SignupFlow({
  inviteRequired,
  initialInviteCode,
}: {
  /** 招待コードが必須か（SIGNUP_MODE。lib/signup/mode.ts） */
  inviteRequired: boolean;
  /** `/signup?code=` で渡されたコード。無ければ空 */
  initialInviteCode: string;
}) {
  const [step, setStep] = useState<Step>("pricing");
  const [storeCount, setStoreCount] = useState(1);
  const [inviteCode, setInviteCode] = useState(initialInviteCode);

  const [companyName, setCompanyName] = useState("");
  const [personName, setPersonName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 試験導入として登録されたか（完了画面に無料期間と月額の案内を出さない） */
  const [pilot, setPilot] = useState(false);

  /**
   * サーバーが「コードが使えない」と返して1つ目の段に戻したとき、コードの欄まで画面を送る。
   * 送信ボタンは画面の下のほうにあるので、戻しただけだと欄が画面の外にあることが多い。
   * 入力欄に focus はしない（スマホでキーボードが開いて、欄の下の理由が隠れるため）。
   */
  const inviteFieldRef = useRef<HTMLDivElement>(null);
  const [revealInviteField, setRevealInviteField] = useState(false);
  useEffect(() => {
    if (step !== "pricing" || !revealInviteField) return;
    inviteFieldRef.current?.scrollIntoView({ block: "center" });
    setRevealInviteField(false);
  }, [step, revealInviteField]);

  /** 料金の段から先へ進む。コードの形だけをここで確かめる（使えるかはサーバーが確かめる） */
  function goToAccount() {
    const typed = inviteCode.trim();
    const normalized = typed ? normalizeInviteCode(typed) : null;
    const inviteError = !typed ? (inviteRequired ? "入力してください" : null) : normalized ? null : INVITE_CODE_UNUSABLE;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.inviteCode;
      if (inviteError) next.inviteCode = inviteError;
      return next;
    });
    if (inviteError) return;
    // 「abcd efgh」→「ABCD-EFGH」。送る値と、戻ったときに見える値をそろえる
    if (normalized) setInviteCode(normalized);
    setFormError(null);
    setStep("account");
  }

  async function submit() {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName, personName, email, password, storeCount, inviteCode }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setPilot(data?.pilot === true);
        setStep("done");
        return;
      }
      const errors: Record<string, string> = data?.fieldErrors ?? {};
      setFieldErrors(errors);
      if (errors.inviteCode) {
        // コードの欄は1つ目の段にある。そこへ戻して、欄の下に理由を出す
        setStep("pricing");
        setRevealInviteField(true);
      } else {
        setFormError(typeof data?.error === "string" ? data.error : "お申し込みを完了できませんでした。");
      }
    } catch {
      setFormError("通信できませんでした。時間をおいてお試しください。");
    }
    setSubmitting(false);
  }

  if (step === "done") return <Done storeCount={storeCount} email={email} pilot={pilot} />;

  return (
    <div className="min-h-dvh w-full" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <header
        className="flex w-full items-center gap-2 px-4 py-4 md:px-10 md:py-5"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-[15px] font-bold tracking-[0.5px] md:text-[18px]" style={{ color: "var(--product-color-text-primary)" }}>
          GOOD REVIEW
        </p>
        <div className="flex-1" />
        <a href="/admin/login" className="whitespace-nowrap text-[12.5px]" style={{ color: "var(--review-accent-primary)" }}>
          すでにご契約の方はログイン
        </a>
      </header>

      <div className="mx-auto flex w-full max-w-[960px] flex-col items-center gap-8 px-4 py-8 md:gap-10 md:px-0 md:py-12">
        {step === "pricing" ? (
          <Pricing
            storeCount={storeCount}
            setStoreCount={setStoreCount}
            invite={{
              value: inviteCode,
              onChange: setInviteCode,
              required: inviteRequired,
              error: fieldErrors.inviteCode,
              fieldRef: inviteFieldRef,
            }}
            onNext={goToAccount}
          />
        ) : (
          <Account
            storeCount={storeCount}
            values={{ companyName, personName, email, password }}
            setters={{ setCompanyName, setPersonName, setEmail, setPassword }}
            fieldErrors={fieldErrors}
            formError={formError}
            submitting={submitting}
            onBack={() => setStep("pricing")}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

/* ── 料金 ─────────────────────────────────────────── */

function Pricing({
  storeCount,
  setStoreCount,
  invite,
  onNext,
}: {
  storeCount: number;
  setStoreCount: (n: number) => void;
  invite: {
    value: string;
    onChange: (v: string) => void;
    required: boolean;
    error?: string;
    fieldRef: RefObject<HTMLDivElement>;
  };
  onNext: () => void;
}) {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-2">
        <h1 className="text-[26px] font-bold md:text-[32px]" style={{ color: "var(--product-color-text-primary)" }}>
          料金
        </h1>
        <p className="text-center text-[13px] md:text-[15px]" style={{ color: "var(--product-color-text-secondary)" }}>
          プランは1つだけ。店舗数で月額が決まります。
        </p>
      </div>

      <div className="flex w-full flex-col items-start gap-6 md:flex-row">
        {/* プランの中身 */}
        <div
          className="flex w-full flex-col items-start gap-5 rounded-3xl p-6 md:p-8"
          style={{ backgroundColor: "var(--product-color-surface-white)", border: "1.5px solid var(--review-accent-primary)" }}
        >
          <div className="flex w-full items-center gap-2">
            <p className="text-[16px] font-bold md:text-[20px]" style={{ color: "var(--product-color-text-primary)" }}>
              {BILLING.planLabel}
            </p>
            <div className="flex-1" />
            <span
              className="whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold md:text-[12px]"
              style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}
            >
              {TRIAL_DAYS}日間無料
            </span>
          </div>

          <p className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold tabular-nums md:text-[40px]" style={{ color: "var(--product-color-text-primary)" }}>
              {BILLING.planMonthlyYen.toLocaleString("ja-JP")}
            </span>
            <span className="text-[12.5px] md:text-[14px]" style={{ color: "var(--product-color-text-secondary)" }}>
              円 / 月・{BILLING.includedStores}店舗まで
            </span>
          </p>

          <ul className="flex w-full flex-col gap-3">
            {[
              "AIがクチコミの下書きを作成します",
              "満足度アンケートと、項目ごとの集計",
              "低評価が入ったときのアラート通知",
              "卓上POPと二次元コードの発行",
              "スタッフの人数制限はありません",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-[13px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
                  ✓
                </span>
                <span className="text-[12.5px] md:text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
                  {f}
                </span>
              </li>
            ))}
          </ul>

          <div className="h-px w-full" style={{ backgroundColor: "var(--product-color-border-divider)" }} />
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
              追加店舗
            </p>
            <p className="text-[13.5px]" style={{ color: "var(--product-color-text-primary)" }}>
              1店舗につき ＋{formatYen(BILLING.additionalStoreMonthlyYen)} / 月
            </p>
          </div>
        </div>

        {/* シミュレーション */}
        <div
          className="flex w-full flex-col items-start gap-5 rounded-3xl p-6 md:w-[380px] md:shrink-0 md:p-8"
          style={{ backgroundColor: "var(--product-color-surface-white)", border: "1px solid var(--product-color-border-divider)" }}
        >
          <p className="text-[15px] font-bold md:text-[16px]" style={{ color: "var(--product-color-text-primary)" }}>
            お店の数を選んでください
          </p>
          <PricingSimulator storeCount={storeCount} onChange={setStoreCount} />
          <div
            className="flex w-full flex-col gap-1 rounded-xl px-4 py-3"
            style={{ backgroundColor: "var(--review-accent-wash)" }}
          >
            <p className="text-[12.5px] font-bold" style={{ color: "var(--review-accent-primary)" }}>
              最初の{TRIAL_DAYS}日間は無料です
            </p>
            <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
              お支払いが始まるのは{TRIAL_DAYS + 1}日目から。無料期間中にやめれば費用はかかりません
            </p>
          </div>
          {/* 招待コード（2026-10-01）。Figma に無い要素なので、アカウント作成の段と同じ入力欄をそのまま使う */}
          <div ref={invite.fieldRef} className="w-full">
            <Field
              label="招待コード"
              hint={invite.required ? "ご案内した8文字のコードを入力してください" : "招待コードをお持ちの方だけ入力してください"}
              placeholder="XXXX-XXXX"
              value={invite.value}
              onChange={invite.onChange}
              error={invite.error}
              required={invite.required}
              code
            />
          </div>
          <ReviewButton variant="primary" onClick={onNext}>
            {TRIAL_DAYS}日間無料で始める
          </ReviewButton>
          <p className="w-full text-center text-[11.5px]" style={{ color: "var(--product-color-text-muted)" }}>
            カードの登録は不要です
          </p>
        </div>
      </div>

      {/* よくある質問 */}
      <div
        className="flex w-full flex-col items-start gap-4 rounded-3xl p-6 md:p-8"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <p className="text-[15px] font-bold md:text-[16px]" style={{ color: "var(--product-color-text-primary)" }}>
          よくある質問
        </p>
        {FAQ.map(([q, a]) => (
          <details key={q} className="w-full border-t pt-4" style={{ borderColor: "var(--product-color-border-divider)" }}>
            <summary
              className="cursor-pointer list-none text-[12.5px] font-bold md:text-[13.5px]"
              style={{ color: "var(--product-color-text-primary)" }}
            >
              {q}
            </summary>
            <p className="pt-2 text-[12.5px] leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
              {a}
            </p>
          </details>
        ))}
      </div>

      <p className="text-center text-[11.5px]" style={{ color: "var(--product-color-text-muted)" }}>
        株式会社UTUTU　|　<a href="/terms" className="underline">利用規約</a>　|
        <a href="/privacy" className="underline">プライバシーポリシー</a>
      </p>
    </>
  );
}

/* ── アカウント作成 ─────────────────────────────────── */

function Account({
  storeCount,
  values,
  setters,
  fieldErrors,
  formError,
  submitting,
  onBack,
  onSubmit,
}: {
  storeCount: number;
  values: { companyName: string; personName: string; email: string; password: string };
  setters: {
    setCompanyName: (v: string) => void;
    setPersonName: (v: string) => void;
    setEmail: (v: string) => void;
    setPassword: (v: string) => void;
  };
  fieldErrors: Record<string, string>;
  formError: string | null;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex w-full max-w-[480px] flex-col items-start gap-6 rounded-3xl p-6 md:p-8"
      style={{ backgroundColor: "var(--product-color-surface-white)" }}
    >
      <div className="flex w-full flex-col items-start gap-2">
        <h1 className="text-[20px] font-bold md:text-[22px]" style={{ color: "var(--product-color-text-primary)" }}>
          アカウントを作る
        </h1>
        <p className="text-[13px]" style={{ color: "var(--product-color-text-secondary)" }}>
          あと1画面で終わります。
        </p>
      </div>

      {formError && (
        <div className="flex w-full flex-col gap-1 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--product-color-status-error-subtle)" }}>
          <p className="text-[12.5px] font-bold" style={{ color: "var(--product-color-status-error)" }}>
            {formError}
          </p>
        </div>
      )}

      {/* 選んだ内容の持ち越し */}
      <div className="flex w-full flex-col gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {BILLING.planLabel}・{storeCount}店舗
          </p>
          <button type="button" onClick={onBack} className="text-[12.5px]" style={{ color: "var(--review-accent-primary)" }}>
            変更
          </button>
        </div>
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
            {TRIAL_DAYS + 1}日目からの月額
          </p>
          <p className="text-[14px] font-bold tabular-nums" style={{ color: "var(--product-color-text-primary)" }}>
            {formatYen(monthlyYenFor(storeCount))}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-4">
        <Field
          label="会社名（法人の方）"
          hint="※個人事業主の方は屋号をご記入ください"
          placeholder="株式会社◯◯"
          value={values.companyName}
          onChange={setters.setCompanyName}
          error={fieldErrors.companyName}
        />
        <Field
          label="お名前"
          placeholder="山田 太郎"
          value={values.personName}
          onChange={setters.setPersonName}
          error={fieldErrors.personName}
        />
        <Field
          label="メールアドレス"
          hint="このアドレスが管理画面のログインIDになります"
          placeholder="owner@example.com"
          type="email"
          value={values.email}
          onChange={setters.setEmail}
          error={fieldErrors.email}
        />
        <Field
          label="パスワード"
          hint={PASSWORD_RULE_TEXT}
          placeholder={PASSWORD_PLACEHOLDER}
          type="password"
          value={values.password}
          onChange={setters.setPassword}
          error={fieldErrors.password}
        />
      </div>

      <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-muted)" }}>
        「{TRIAL_DAYS}日間無料で始める」を押すと、<a href="/terms" className="underline">利用規約</a>と
        <a href="/privacy" className="underline">プライバシーポリシー</a>に同意したものとみなします
      </p>

      <ReviewButton variant="primary" type="submit" disabled={submitting}>
        {submitting ? "お申し込み中..." : `${TRIAL_DAYS}日間無料で始める`}
      </ReviewButton>
      <p className="w-full text-center text-[11.5px]" style={{ color: "var(--product-color-text-muted)" }}>
        カードの登録は不要です
      </p>
    </form>
  );
}

function Field({
  label,
  hint,
  placeholder,
  value,
  onChange,
  error,
  type = "text",
  required = true,
  code = false,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "email" | "password";
  /** 「必須」の印を出すか。招待コードは SIGNUP_MODE=open のとき任意（2026-10-01） */
  required?: boolean;
  /**
   * 英数字のコードを打つ欄か（招待コード）。スマホで大文字から打てるようにし、
   * 入力履歴の候補と綴りの下線を止める。**見た目は他の欄と同じ。**
   */
  code?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <p className="text-[12px]" style={{ color: "var(--product-color-text-secondary)" }}>
          {label}
        </p>
        {required && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "var(--product-color-status-error-subtle)", color: "var(--product-color-status-error)" }}
          >
            必須
          </span>
        )}
      </div>
      {hint && (
        <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-muted)" }}>
          {hint}
        </p>
      )}
      <ReviewInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        error={Boolean(error)}
        {...(code ? { autoCapitalize: "characters", autoComplete: "off", spellCheck: false } : {})}
      />
      {error && (
        <p className="text-[11.5px]" style={{ color: "var(--product-color-status-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ── 完了 ─────────────────────────────────────────── */

function Done({ storeCount, email, pilot }: { storeCount: number; email: string; pilot: boolean }) {
  return (
    <div
      className="flex min-h-dvh w-full items-center justify-center px-4"
      style={{ backgroundColor: "var(--product-color-bg-primary)" }}
    >
      <div
        className="flex w-full max-w-[480px] flex-col items-center gap-6 rounded-3xl p-8 md:p-10"
        style={{ backgroundColor: "var(--product-color-surface-white)" }}
      >
        <div
          className="grid h-16 w-16 place-items-center rounded-full text-[28px] font-bold"
          style={{ backgroundColor: "var(--review-accent-wash)", color: "var(--review-accent-primary)" }}
        >
          ✓
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <h1 className="text-center text-[19px] font-bold md:text-[20px]" style={{ color: "var(--product-color-text-primary)" }}>
            確認メールをお送りしました
          </h1>
          <p className="text-center text-[13px] leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
            {email} 宛にメールを送りました。
            <br />
            メールのリンクを開くと、お店の設定に進めます。
          </p>
        </div>

        {/* 試験導入（招待コードで登録）は無料なので、無料期間と月額の案内を出さない（2026-10-01） */}
        {!pilot && (
          <div className="flex w-full flex-col gap-2 rounded-2xl px-5 py-4" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
                無料期間
              </p>
              <p className="text-[13px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                {TRIAL_DAYS}日間
              </p>
            </div>
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-[12.5px]" style={{ color: "var(--product-color-text-secondary)" }}>
                {TRIAL_DAYS + 1}日目からの月額
              </p>
              <p className="text-[13px] font-bold tabular-nums" style={{ color: "var(--product-color-text-primary)" }}>
                {formatYen(monthlyYenFor(storeCount))}（{storeCount}店舗）
              </p>
            </div>
            <p className="text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-muted)" }}>
              期限が近づいたらメールでお知らせします。設定＞お支払いから、いつでもカードを登録できます
            </p>
          </div>
        )}

        <p className="text-center text-[11.5px] leading-[1.6]" style={{ color: "var(--product-color-text-muted)" }}>
          メールが届かない場合は、迷惑メールフォルダもご確認ください
        </p>
      </div>
    </div>
  );
}
