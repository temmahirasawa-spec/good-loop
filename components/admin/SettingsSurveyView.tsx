"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { EditTag, AddTagButton } from "@/components/admin/EditTag";
import { LoopInput } from "@/components/admin/LoopInput";

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
 */
function TagGroup({
  storeId,
  category,
  title,
  presetTags,
  tags,
  onChange,
}: {
  storeId: string;
  category: "good" | "improve";
  title: string;
  presetTags: string[];
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function applyChange(next: string[]) {
    const prev = tags;
    onChange(next);
    setError(null);
    const errorMessage = await persistTags(storeId, category, next);
    if (errorMessage) {
      onChange(prev);
      setError(errorMessage);
    }
  }

  function commitAdd() {
    const label = draft.trim();
    if (label && !tags.includes(label)) applyChange([...tags, label]);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex w-full flex-col items-start gap-3 pt-2">
      <div className="flex w-full flex-col items-start justify-between gap-2 md:flex-row md:items-center">
        <p className="text-[15px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          {title}
        </p>
        <div className="w-full md:w-auto">
          <LoopButton variant="primary" onClick={() => applyChange([...presetTags])}>
            プリセットに戻す
          </LoopButton>
        </div>
      </div>
      {error && (
        <p className="text-[12px] font-medium" style={{ color: "var(--product-color-status-warning)" }}>
          {error}
        </p>
      )}
      <div className="flex w-full flex-wrap items-start gap-3">
        {tags.map((tag) => (
          <EditTag key={tag} label={tag} onRemove={() => applyChange(tags.filter((t) => t !== tag))} />
        ))}
        {tags.length < MAX_TAGS &&
          (adding ? (
            <div className="flex items-center gap-2">
              <LoopInput value={draft} onChange={setDraft} placeholder="項目名" className="!h-11 !w-[160px]" />
              <button type="button" onClick={commitAdd} className="text-sm font-bold" style={{ color: "var(--loop-accent-action)" }}>
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
 * プリセットは業態別ではなく tags_master 全体を参照している現状のまま
 * （データ取得は親の app/admin/(dashboard)/settings/survey/page.tsx）。
 */
export function SettingsSurveyView({
  storeId,
  initialGoodTags,
  initialImproveTags,
  presetGoodTags,
  presetImproveTags,
}: {
  storeId: string;
  initialGoodTags: string[];
  initialImproveTags: string[];
  presetGoodTags: string[];
  presetImproveTags: string[];
}) {
  const [goodTags, setGoodTags] = useState<string[]>(initialGoodTags);
  const [improveTags, setImproveTags] = useState<string[]>(initialImproveTags);

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        アンケート項目
      </p>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        プリセットは業態テーマに合わせて用意されています。自由に編集できます（各 最大8個）
      </p>
      <TagGroup
        storeId={storeId}
        category="good"
        title="良かった点（★5・4のお客様に表示）"
        presetTags={presetGoodTags}
        tags={goodTags}
        onChange={setGoodTags}
      />
      <TagGroup
        storeId={storeId}
        category="improve"
        title="改善点（★3・2・1のお客様に表示）"
        presetTags={presetImproveTags}
        tags={improveTags}
        onChange={setImproveTags}
      />
    </div>
  );
}
