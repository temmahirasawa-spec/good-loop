"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoopButton } from "@/components/rating-flow/Button";
import { StoreEditModal } from "@/components/admin/StoreEditModal";
import { AddStoreModal } from "@/components/admin/AddStoreModal";
import { QrCard, QrCardMobile } from "@/components/admin/QrCard";
import { BILLING, formatYen } from "@/lib/admin/constants";

/** 店舗枠の状態（lib/admin/store-quota.ts）。表示に必要な分だけ受け取る */
export type StoreQuotaProps = {
  /** 契約している店舗数。読み取れなかったときは null（数字を出さない） */
  quota: number | null;
  used: number;
  canAddStore: boolean;
};

export type SettingsStoreRow = {
  id: string;
  name: string;
  slug: string;
  businessCategory: string;
  googlePlaceLinked: boolean;
  qrSvg: string;
  qrReads: number;
  qrReadsLow: boolean;
};

/**
 * 設定（店舗・二次元コード管理） Figma node 73:1364 PC / 75:1803 SP の表示部分
 * （2026-08-06、天真の依頼で旧 /admin/qr の二次元コード発行をここに統合。詳細はdocs/handoff.md参照）。
 * データ取得は親（app/admin/(dashboard)/settings/stores/page.tsx）が行う。
 *
 * 編集の保存は StoreEditModal が直接 stores を更新する（Google Places API接続済み、2026-08-06）。
 * 「＋ 店舗を追加」は AddStoreModal が /api/admin/settings/stores 経由で新規作成する。
 * Googleマップ紐付けは追加時点でもできるようにした（2026-08-06）ため、店舗を追加した直後から
 * QRコード・お客様の★4/5評価後のGoogleマップ遷移先が有効になる。
 *
 * 2026-08-21、**店舗枠**（契約している店舗数）を導入した（supabase/0009）。
 * 枠に空きが無いときは「＋ 店舗を追加」を押せなくし、お支払い画面へ誘導する。
 * サーバー側・DB側にも同じ判定があるので、ここは案内のための表示という位置づけ。
 */
export function SettingsStoresView({ stores, quota }: { stores: SettingsStoreRow[]; quota: StoreQuotaProps }) {
  const router = useRouter();
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set(stores.filter((s) => s.googlePlaceLinked).map((s) => s.id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // storesはサーバーコンポーネントの再取得（router.refresh()）のたびに新しい配列で渡ってくる。
  // useStateの初期値は初回描画にしか効かないため、店舗追加直後の再取得を反映できるよう同期する
  // （StoreEditModalの編集は router.refresh() を呼ばず setLinkedIds で楽観的更新するので、ここでは上書きしない）。
  useEffect(() => {
    setLinkedIds(new Set(stores.filter((s) => s.googlePlaceLinked).map((s) => s.id)));
  }, [stores]);

  const editingStore = stores.find((s) => s.id === editingId) ?? null;

  return (
    <>
      <div className="flex w-full flex-col items-start gap-4 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <p className="text-base font-bold" style={{ color: "var(--product-color-text-primary)" }}>
          店舗・二次元コード管理
        </p>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          店舗ごとに Googleマップ上のお店を店名で検索して紐付けます。紐付けると、お客様をクチコミ投稿画面へ直接誘導できます。
          印刷して店舗に置くだけで、アンケートとレビュー送客が始まります
        </p>
        {stores.map((store) => {
          const linked = linkedIds.has(store.id);
          return (
            <div key={store.id} className="flex w-full items-center justify-between border-b px-1 py-3" style={{ borderColor: "var(--product-color-border-divider)" }}>
              <div className="flex items-center gap-3">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                  {store.name}
                </p>
                <span
                  className="rounded-full px-2 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: linked ? "var(--loop-accent-wash)" : "var(--product-color-bg-primary)",
                    color: linked ? "var(--loop-accent-action)" : "var(--product-color-status-error)",
                  }}
                >
                  {linked ? "Googleマップ連携済み" : "URL未設定"}
                </span>
              </div>
              <button type="button" onClick={() => setEditingId(store.id)} className="text-[12.5px] font-medium" style={{ color: "var(--loop-accent-action)" }}>
                編集
              </button>
            </div>
          );
        })}
        <div className="flex w-full items-center justify-between">
          <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
            契約中の店舗枠
          </p>
          <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
            {quota.quota === null ? "—" : `${quota.used} / ${quota.quota} 店舗`}
          </p>
        </div>

        {quota.canAddStore ? (
          <LoopButton variant="primary" onClick={() => setAdding(true)}>
            ＋ 店舗を追加
          </LoopButton>
        ) : (
          <div className="flex w-full flex-col items-start gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {quota.quota === null
                ? "店舗枠を取得できませんでした。時間をおいてページを開き直してください"
                : `店舗枠がいっぱいです。店舗を追加するには、お支払い画面で店舗枠を追加してください（追加1店舗につき月額${formatYen(BILLING.additionalStoreMonthlyYen)}）`}
            </p>
            {quota.quota !== null && (
              <LoopButton variant="primary" onClick={() => router.push("/admin/settings/billing")}>
                お支払いへ進む
              </LoopButton>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full flex-wrap items-start gap-4">
        {stores.map((store) => (
          <QrCard key={store.id} storeName={store.name} slug={store.slug} qrSvg={store.qrSvg} reads={store.qrReads} low={store.qrReadsLow} />
        ))}
      </div>
      <div className="flex w-full flex-col items-start gap-3 md:hidden">
        {stores.map((store) => (
          <QrCardMobile key={store.id} storeName={store.name} slug={store.slug} qrSvg={store.qrSvg} reads={store.qrReads} low={store.qrReadsLow} />
        ))}
      </div>

      {editingStore && (
        <StoreEditModal
          storeId={editingStore.id}
          storeName={editingStore.name}
          businessCategory={editingStore.businessCategory}
          linked={linkedIds.has(editingStore.id)}
          onClose={() => setEditingId(null)}
          onSave={() => {
            setLinkedIds((prev) => new Set(prev).add(editingStore.id));
            setEditingId(null);
          }}
        />
      )}

      {adding && (
        <AddStoreModal
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
