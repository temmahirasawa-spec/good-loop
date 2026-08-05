"use client";

import { useState } from "react";
import { LoopButton } from "@/components/rating-flow/Button";
import { EditTag, AddTagButton } from "@/components/admin/EditTag";
import { LoopInput } from "@/components/admin/LoopInput";
import { GOOD_TAGS } from "@/components/rating-flow/screens/GoodFeedback";
import { IMPROVE_CHECKLIST } from "@/components/rating-flow/screens/ImproveSurvey";

const MAX_TAGS = 8;

/** タグ編集グループ（Figma node 69:1343 系）— 良かった点／改善点で共通の挙動 */
function TagGroup({
  title,
  presetTags,
  tags,
  onChange,
}: {
  title: string;
  presetTags: readonly string[];
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commitAdd() {
    const label = draft.trim();
    if (label && !tags.includes(label)) onChange([...tags, label]);
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
          <LoopButton variant="primary" onClick={() => onChange([...presetTags])}>
            プリセットに戻す
          </LoopButton>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-start gap-3">
        {tags.map((tag) => (
          <EditTag key={tag} label={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))} />
        ))}
        {tags.length < MAX_TAGS &&
          (adding ? (
            <div className="flex items-center gap-2">
              <LoopInput
                value={draft}
                onChange={setDraft}
                placeholder="項目名"
                className="!h-11 !w-[160px]"
              />
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
 * プリセットは業態テーマ（設定・ブランドとテーマ）に応じて用意される想定だが、
 * 業態別プリセットのテーブルはまだ無いため、現状は飲食店（YORKYS BRUNCHの業態）の
 * プリセット固定。保存APIにはまだ繋がっていない（docs/specs/launch-plan.md 4-B参照）。
 */
export default function SettingsSurveyPage() {
  const [goodTags, setGoodTags] = useState<string[]>([...GOOD_TAGS]);
  const [improveTags, setImproveTags] = useState<string[]>([...IMPROVE_CHECKLIST]);

  return (
    <div className="flex w-full flex-col items-start gap-6 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
      <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
        アンケート項目
      </p>
      <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
        プリセットは業態テーマに合わせて用意されています。自由に編集できます（各 最大8個）
      </p>
      <TagGroup title="良かった点（★5・4のお客様に表示）" presetTags={GOOD_TAGS} tags={goodTags} onChange={setGoodTags} />
      <TagGroup title="改善点（★3・2・1のお客様に表示）" presetTags={IMPROVE_CHECKLIST} tags={improveTags} onChange={setImproveTags} />
    </div>
  );
}
