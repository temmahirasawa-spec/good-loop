"use client";

import { useEffect, useRef, useState } from "react";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { BUSINESS_CATEGORIES, INDUSTRY_THEMES, SURVEY_TALLY_NOTE } from "@/lib/admin/constants";
import type { TagPreset } from "@/lib/store-tags";

/**
 * オンボーディング 8ステップ（Figma `08 オンボーディング / Onboarding`）。
 *
 * ステップ1〜6の入力はこのコンポーネントの中に持ち、**ステップ6の完了時に
 * 店舗を一括作成する**（既存の POST /api/admin/settings/stores）。
 * 途中の入力は localStorage に残す（「途中でやめても、続きから戻れます」の実体）。
 *
 * 器は Figma のとおり:
 *   PC = 灰色の地に白いカード（640px・角丸24）
 *   SP = 全面が白。「次へ」は下端から40pxに固定（2026-08-24 天真の指示）。
 *        固定と引き換えに、コンテンツ下端へボタンぶんの余白を確保する（design-rules 2-1a）
 */

type Place = { placeId: string; name: string; address: string };

/** 途中でやめても戻れるように残す下書き。店舗を作った時点で消す */
type Draft = {
  step: number;
  storeName: string;
  category: string;
  theme: string | null; // null = まだ手で選んでいない（業態と同じ色を既定にする）
  place: Place | null;
};

const DRAFT_KEY = "goodreview:onboarding:draft";

const TOTAL_STEPS = 8;

export function OnboardingFlow({ presets }: { presets: Record<string, TagPreset> }) {
  const [step, setStep] = useState(1);
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState("restaurant");
  // 色は「業態と同じ色」を既定にする（INDUSTRY_THEMES と BUSINESS_CATEGORIES は同じスラッグ）。
  // 手で選んだら以後は業態に追従させない
  const [theme, setTheme] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

  const [nameError, setNameError] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ storeId: string; qrSvg: string } | null>(null);

  // ── 下書きの復元と保存 ──────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (typeof d.step === "number" && d.step >= 1 && d.step <= 6) {
        setStep(d.step);
        setStoreName(d.storeName ?? "");
        if (BUSINESS_CATEGORIES.some((c) => c.slug === d.category)) setCategory(d.category);
        setTheme(typeof d.theme === "string" ? d.theme : null);
        setPlace(d.place ?? null);
      }
    } catch {
      // 壊れた下書きは無視して最初から
    }
  }, []);
  useEffect(() => {
    if (created) return; // 店舗を作ったら下書きは不要
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, storeName, category, theme, place } satisfies Draft));
    } catch {
      // 保存できなくても続行に支障はない
    }
  }, [step, storeName, category, theme, place, created]);

  const effectiveTheme = theme ?? category;

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function submitName() {
    if (storeName.trim() === "") {
      setNameError(true);
      return;
    }
    setNameError(false);
    next();
  }

  /** ステップ6完了 → 店舗を作成してステップ7へ */
  async function createStore() {
    setCreating(true);
    setCreateError(null);
    try {
      // URLの一部（スラッグ）は店名から自動で作る（オンボーディングでは聞かない）
      const slugRes = await fetch("/api/admin/settings/stores/suggest-slug", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: storeName.trim() }),
      });
      const { slug } = await slugRes.json();
      if (!slug) throw new Error("slug suggestion failed");

      const res = await fetch("/api/admin/settings/stores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: storeName.trim(),
          businessCategory: category,
          loopTheme: effectiveTheme,
          slug,
          ...(place ? { googlePlaceId: place.placeId } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.store) {
        setCreateError(typeof data?.error === "string" ? data.error : "作成できませんでした。もう一度お試しください。");
        return;
      }
      setCreated({ storeId: data.store.id, qrSvg: data.qrSvg ?? "" });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // 消せなくても、次回はサーバー側の店舗有無の判定で管理画面へ行く
      }
      next();
    } catch {
      setCreateError("作成できませんでした。通信環境をご確認のうえ、もう一度お試しください。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-dvh w-full md:grid md:place-items-center" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <div
        className="flex min-h-dvh w-full flex-col items-start gap-6 bg-[var(--product-color-surface-white)] px-6 pb-40 pt-8 md:min-h-0 md:w-[640px] md:gap-6 md:rounded-3xl md:px-12 md:py-10"
      >
        <ProgressBar step={step} />

        {step === 1 && (
          <StepFrame
            title="GOOD REVIEWへようこそ"
            description="3分で、店頭に置く二次元コードまで作ります。途中でやめても、続きから戻れます。"
            primaryLabel="はじめる"
            onPrimary={next}
          />
        )}

        {step === 2 && (
          <StepFrame
            title="お店の名前を教えてください"
            description="管理画面での表示名です。あとから変えられます。"
            primaryLabel="次へ"
            onPrimary={submitName}
          >
            <ReviewInput
              value={storeName}
              onChange={(v) => {
                setStoreName(v);
                if (nameError && v.trim() !== "") setNameError(false);
              }}
              placeholder="例：YORKYS BRUNCH 夙川店"
              error={nameError}
            />
            {nameError && (
              <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
                お店の名前を入力してください
              </p>
            )}
          </StepFrame>
        )}

        {step === 3 && (
          <StepFrame
            title="業態を選んでください"
            description="アンケート項目のプリセットが決まります。あとから変えられます。"
            primaryLabel="次へ"
            onPrimary={next}
          >
            <div className="flex w-full flex-wrap gap-2">
              {BUSINESS_CATEGORIES.map((c) => {
                const selected = c.slug === category;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCategory(c.slug)}
                    className="rounded-full border px-4 py-2.5 text-[13px]"
                    style={{
                      backgroundColor: selected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                      borderColor: selected ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
                      borderWidth: selected ? 1.5 : 1,
                      color: selected ? "var(--review-accent-primary)" : "var(--product-color-text-secondary)",
                      fontWeight: selected ? 700 : 500,
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </StepFrame>
        )}

        {step === 4 && (
          <StepFrame
            title="アンケート項目を確認してください"
            description="お客様に選んでもらう項目です。"
            primaryLabel="次へ"
            onPrimary={next}
          >
            {/* グループの見出しは設定＞アンケート項目と同じ言葉にそろえる */}
            <TagPreview label="良かった点（★5・4のお客様に表示）" tags={presets[category]?.good ?? []} />
            <TagPreview label="改善点（★3・2・1のお客様に表示）" tags={presets[category]?.improve ?? []} />
            <p className="text-[12px] font-medium leading-[1.7]" style={{ color: "var(--product-color-text-tertiary)" }}>
              {SURVEY_TALLY_NOTE}
            </p>
          </StepFrame>
        )}

        {step === 5 && (
          <PlaceStep
            place={place}
            onSelect={setPlace}
            onNext={next}
            onSkip={() => {
              setPlace(null);
              next();
            }}
          />
        )}

        {step === 6 && (
          <StepFrame
            title="お客様に見える色を選んでください"
            description="お客様側の画面の色を選べます"
            primaryLabel={creating ? "作成しています..." : "次へ"}
            primaryDisabled={creating}
            onPrimary={createStore}
            secondaryLabel="あとで設定する"
            onSecondary={creating ? undefined : createStore}
          >
            <div className="flex w-full flex-wrap gap-3">
              {INDUSTRY_THEMES.map((t) => {
                const selected = t.slug === effectiveTheme;
                return (
                  <button
                    key={t.slug}
                    type="button"
                    aria-label={t.label}
                    onClick={() => setTheme(t.slug)}
                    className="grid size-12 place-items-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: t.swatchPrimary }}
                  >
                    {selected ? "✓" : ""}
                  </button>
                );
              })}
            </div>
            {createError && (
              <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
                {createError}
              </p>
            )}
          </StepFrame>
        )}

        {step === 7 && created && (
          <StepFrame
            title="二次元コードができました"
            description="卓上POPに印刷して、席に置いてください。"
            primaryLabel="印刷する"
            onPrimary={() => {
              window.open(`/admin/pop/${created.storeId}`, "_blank", "noopener");
              next();
            }}
            secondaryLabel="あとで印刷する"
            onSecondary={next}
          >
            <div
              className="relative size-40 overflow-hidden rounded-xl border p-2 [&>svg]:size-full"
              style={{ backgroundColor: "white", borderColor: "var(--product-color-border-divider)" }}
              // eslint-disable-next-line react/no-danger -- lib/qr-code.tsがサーバー側で生成した固定フォーマットのSVGで、外部入力を含まない
              dangerouslySetInnerHTML={{ __html: created.qrSvg }}
            />
          </StepFrame>
        )}

        {step === 8 && (
          <StepFrame
            title="準備ができました"
            description="あとはお客様が読み取るのを待つだけです。"
            primaryLabel="管理画面をひらく"
            onPrimary={() => {
              // ルーターの遷移だと (dashboard) レイアウトのキャッシュが「店舗0件」の
              // 判定を覚えていることがあるため、素直にページごと読み直す
              window.location.href = "/admin";
            }}
          >
            <ul className="flex w-full flex-col gap-2">
              {[
                "低評価が来たらメールで知らせる（通知）",
                "2店舗目を追加する（お支払い）",
                "回答が届いたら回答一覧で見る",
              ].map((t) => (
                <li key={t} className="text-[13px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                  ・{t}
                </li>
              ))}
            </ul>
          </StepFrame>
        )}
      </div>
    </div>
  );
}

/* ── 進み具合 ─────────────────────────────────────── */

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--product-color-bg-tertiary)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: "var(--review-accent-primary)" }}
        />
      </div>
      <p className="text-xs font-medium tabular-nums" style={{ color: "var(--product-color-text-secondary)" }}>
        {step} / {TOTAL_STEPS}
      </p>
    </div>
  );
}

/* ── ステップ4: プリセットの一覧（良かった点／改善点） ────── */

function TagPreview({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="flex w-full flex-col items-start gap-2">
      <p className="text-[12px] font-bold" style={{ color: "var(--product-color-text-secondary)" }}>
        {label}
      </p>
      <div className="flex w-full flex-wrap gap-2">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-full border px-4 py-2.5 text-[13px] font-medium"
            style={{ borderColor: "var(--product-color-border-default)", color: "var(--product-color-text-primary)" }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 各ステップの器（見出し・中身・操作） ───────────────── */

function StepFrame({
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <>
      <div className="flex w-full flex-col items-start gap-4">
        <div className="flex w-full flex-col items-start gap-2">
          <h1 className="text-[22px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {title}
          </h1>
          <p className="text-[13.5px] font-medium leading-[1.7]" style={{ color: "var(--product-color-text-secondary)" }}>
            {description}
          </p>
        </div>
        {children}
      </div>

      {/* SPは下端から40pxに固定（design-rules 2-1a の条件つき許可）。PCはカード内に置く */}
      <div
        className="fixed inset-x-0 bottom-0 flex w-full flex-col items-center gap-3 bg-[var(--product-color-surface-white)] px-6 pb-10 pt-4 md:static md:bg-transparent md:p-0"
      >
        <ReviewButton variant="primary" disabled={primaryDisabled} onClick={onPrimary}>
          {primaryLabel}
        </ReviewButton>
        {secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            disabled={!onSecondary}
            className="text-[12.5px] font-medium disabled:opacity-50"
            style={{ color: "var(--product-color-text-secondary)" }}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </>
  );
}

/* ── ステップ5: Googleマップの紐付け ─────────────────── */

function PlaceStep({
  place,
  onSelect,
  onNext,
  onSkip,
}: {
  place: Place | null;
  onSelect: (p: Place | null) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState(place?.name ?? "");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Place[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 入力が止まってから検索する（1文字ごとに叩くとGoogleの課金が嵩む。既存の店舗編集と同じ形） */
  function handleInput(v: string) {
    setQuery(v);
    onSelect(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim() === "") {
      setCandidates(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/places/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: v.trim() }),
        });
        const data = await res.json().catch(() => null);
        setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
      } catch {
        setCandidates([]);
      }
      setSearching(false);
    }, 400);
  }

  return (
    <StepFrame
      title="Googleマップのお店を選んでください"
      description="★4・5のお客様を、このお店のクチコミ投稿画面へ直接ご案内します。"
      primaryLabel="次へ"
      primaryDisabled={!place}
      onPrimary={onNext}
      secondaryLabel="あとで設定する"
      onSecondary={onSkip}
    >
      <ReviewInput value={query} onChange={handleInput} placeholder="店名で検索（例：ヨーキーズブランチ）" />

      {searching && (
        <div className="flex w-full flex-col gap-2 rounded-xl p-4" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            検索しています…
          </p>
          <div className="h-3.5 w-1/2 rounded-md" style={{ backgroundColor: "var(--product-color-border-divider)" }} />
          <div className="h-3.5 w-2/3 rounded-md" style={{ backgroundColor: "var(--product-color-border-divider)" }} />
        </div>
      )}

      {!searching && candidates !== null && candidates.length === 0 && (
        <div className="flex w-full flex-col gap-1 rounded-xl p-4" style={{ backgroundColor: "var(--product-color-bg-secondary)" }}>
          <p className="text-[12.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            お店が見つかりませんでした
          </p>
          <p className="text-[11.5px] font-medium leading-[1.6]" style={{ color: "var(--product-color-text-secondary)" }}>
            Googleマップに登録されている名前で、もう一度お試しください。見つからない場合は「あとで設定する」で先に進めます
          </p>
        </div>
      )}

      {!searching && candidates !== null && candidates.length > 0 && (
        <div className="w-full overflow-hidden rounded-xl border" style={{ borderColor: "var(--product-color-border-divider)" }}>
          {candidates.map((c, i) => {
            const selected = place?.placeId === c.placeId;
            return (
              <button
                key={c.placeId}
                type="button"
                onClick={() => onSelect(c)}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
                style={{
                  backgroundColor: selected ? "var(--review-accent-wash)" : "var(--product-color-surface-white)",
                  borderTop: i > 0 ? "1px solid var(--product-color-border-divider)" : undefined,
                }}
              >
                <p className="text-[13px]" style={{ color: selected ? "var(--review-accent-primary)" : "var(--product-color-text-primary)", fontWeight: selected ? 700 : 500 }}>
                  {c.name}
                </p>
                <p className="text-[11.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
                  {c.address}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {place && (
        <p className="text-[11.5px] font-medium leading-[1.6]" style={{ color: "var(--product-color-text-tertiary)" }}>
          お店を選ぶと、★4・5のお客様がこのお店のクチコミ投稿画面へ進みます
        </p>
      )}
    </StepFrame>
  );
}
