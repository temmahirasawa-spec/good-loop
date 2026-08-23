"use client";

import { useState } from "react";
import { EditTag, AddTagButton } from "@/components/admin/EditTag";
import { ReviewInput } from "@/components/admin/ReviewInput";
import { ReviewButton } from "@/components/rating-flow/Button";
import { ReviewSelect } from "@/components/admin/ReviewSelect";
import { BUSINESS_CATEGORIES } from "@/lib/admin/constants";
import type { TagPreset } from "@/lib/store-tags";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { SurveyIcon } from "@/components/admin/SettingsMenuIcons";

const MAX_TAGS = 8;
const DEFAULT_ERROR = "保存できませんでした。もう一度お試しください。";

async function persistTags(storeId: string, category: "good" | "improve", labels: string[]): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/settings/survey-tags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, category, labels }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.error === "string" ? data.error : DEFAULT_ERROR;
  } catch {
    return DEFAULT_ERROR;
  }
}

/** タグ編集グループ（Figma node 69:1343 系）— 良かった点／改善点で共通の挙動
 *
 * 楽観的更新（CLAUDE.md 4章）：ローカル状態を先に更新し、保存に失敗したときだけ元に戻す。
 *
 * 2026-08-22、天真の依頼で「プリセットに戻す」ボタンを**業態のドロップダウン**に差し替えた。
 * 業態を選ぶと、このグループの項目がその業態のプリセットに入れ替わる。
 * 初期値はその店舗の業態。ここで選んでも店舗自体の業態設定（店舗編集で選ぶもの）は変えない
 * ＝「他の業態の言い回しも借りられる」ための操作、という位置づけ。
 */
function TagGroup({
  category,
  title,
  presets,
  defaultCategorySlug,
  tags,
  onChange,
}: {
  category: "good" | "improve";
  title: string;
  presets: Record<string, TagPreset>;
  defaultCategorySlug: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [presetSlug, setPresetSlug] = useState(defaultCategorySlug);

  // 編集はローカル状態だけを変える。保存はカード下の「保存する」ボタンで一括
  // （2026-08-23、Figmaコメント 1895968356。ブランド・テーマ・通知と同じ方式に揃えた）
  function applyChange(next: string[]) {
    onChange(next);
  }

  function applyPreset(slug: string) {
    setPresetSlug(slug);
    const preset = presets[slug];
    if (preset) applyChange([...preset[category]]);
  }

  function commitAdd() {
    const label = draft.trim();
    if (label && !tags.includes(label)) applyChange([...tags, label]);
    setDraft("");
    setAdding(false);
  }

  return (
    // サブカード化（2026-08-23、Figmaコメント 1895943637「レイアウトや並びが悪い。直感的に」）。
    // 良かった点／改善点のまとまりを薄い背景で切り、操作の対象範囲を目で分かるようにする
    <div className="flex w-full flex-col items-start gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
      <div className="flex w-full flex-col items-start justify-between gap-2 md:flex-row md:items-center">
        <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </p>
        <div className="flex w-full flex-col items-start gap-1 md:w-auto md:flex-row md:items-center md:gap-3">
          <p className="whitespace-nowrap text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            業態のプリセットを読み込む
          </p>
          <ReviewSelect
            ariaLabel={`${title}のプリセットを業態から選ぶ`}
            value={presetSlug}
            onChange={applyPreset}
            options={BUSINESS_CATEGORIES.map((c) => ({ value: c.slug, label: c.label }))}
            className="w-full md:w-[180px]"
          />
        </div>
      </div>
      <div className="flex w-full flex-wrap items-start gap-3">
        {tags.map((tag) => (
          <EditTag key={tag} label={tag} onRemove={() => applyChange(tags.filter((t) => t !== tag))} />
        ))}
        {tags.length < MAX_TAGS &&
          (adding ? (
            <div className="flex items-center gap-2">
              <ReviewInput value={draft} onChange={setDraft} placeholder="項目名" className="!h-11 !w-[160px]" />
              <button type="button" onClick={commitAdd} className="text-sm font-bold" style={{ color: "var(--review-accent-primary)" }}>
                追加
              </button>
            </div>
          ) : (
            <AddTagButton onClick={() => setAdding(true)} />
          ))}
      </div>
    </div>
  );
}

/**
 * 設定（アンケート項目） Figma node 73:1294 PC / 75:1699 SP。
 *
 * 2026-08-21、店舗ごとの設定になった。どの店舗を編集しているかは、この画面の上にある
 * 店舗タブ（StoreSwitchTabs）と、このカードの見出しの店舗名で示す。
 * プリセットはその店舗の業態のもの（データ取得は親の
 * app/admin/(dashboard)/settings/survey/page.tsx）。
 */
export function SettingsSurveyView({
  storeId,
  storeName,
  businessCategory,
  initialGoodTags,
  initialImproveTags,
  presets,
}: {
  storeId: string;
  storeName: string;
  businessCategory: string;
  initialGoodTags: string[];
  initialImproveTags: string[];
  presets: Record<string, TagPreset>;
}) {
  const [goodTags, setGoodTags] = useState<string[]>(initialGoodTags);
  const [improveTags, setImproveTags] = useState<string[]>(initialImproveTags);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string>(DEFAULT_ERROR);

  async function save() {
    setSaving(true);
    setSaveState("idle");
    const [goodError, improveError] = await Promise.all([
      persistTags(storeId, "good", goodTags),
      persistTags(storeId, "improve", improveTags),
    ]);
    const errorMessage = goodError ?? improveError;
    setSaving(false);
    if (errorMessage) {
      setSaveError(errorMessage);
      setSaveState("error");
    } else {
      setSaveState("saved");
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <SettingsCardTitle icon={<SurveyIcon />}>アンケート項目</SettingsCardTitle>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        {storeName}の設定です。業態を選ぶとその業態のプリセットを読み込めます。項目は自由に編集できます（各 最大8個）
      </p>
      <TagGroup
        category="good"
        title="良かった点（★5・4のお客様に表示）"
        presets={presets}
        defaultCategorySlug={businessCategory}
        tags={goodTags}
        onChange={setGoodTags}
      />
      <TagGroup
        category="improve"
        title="改善点（★3・2・1のお客様に表示）"
        presets={presets}
        defaultCategorySlug={businessCategory}
        tags={improveTags}
        onChange={setImproveTags}
      />
      {/* 保存ボタン（2026-08-23、Figmaコメント 1895968356）。PCは右寄せ、SPは全幅 */}
      <div className="flex w-full flex-col items-stretch gap-2 md:flex-row-reverse md:items-center md:justify-start md:gap-3">
        <div className="w-full md:w-fit">
          <ReviewButton variant="primary" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存する"}
          </ReviewButton>
        </div>
        {saveState === "saved" && (
          <p className="text-[12.5px] font-medium" style={{ color: "var(--review-accent-primary)" }}>
            保存しました
          </p>
        )}
        {saveState === "error" && !saving && (
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-status-error)" }}>
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}
