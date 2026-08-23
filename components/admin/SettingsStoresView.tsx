"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ReviewButton } from "@/components/rating-flow/Button";
import { SettingsCardTitle } from "@/components/admin/SettingsCardTitle";
import { StoreIcon } from "@/components/admin/SettingsMenuIcons";
import { StoreEditModal } from "@/components/admin/StoreEditModal";
import { AddStoreModal } from "@/components/admin/AddStoreModal";
import { QrCard, QrCardMobile } from "@/components/admin/QrCard";

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
  /** お客様が開く投稿画面のURL（コピーして共有できるように表示する） */
  publicUrl: string;
  businessCategory: string;
  googlePlaceLinked: boolean;
  qrSvg: string;
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
/**
 * お客様が開く投稿画面のURL。押すとコピーできる（2026-08-22 天真のFigmaコメント
 * 「コピーできる投稿画面のURLを表示」）。SNSやLINEで直接送りたいときに使う。
 */
/** コピーの2枚重ねアイコン（Figmaコメント 1895820976「アイコンもつけて」） */
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
      <path d="M10.5 3.2A1.7 1.7 0 0 0 8.8 2H4.2A2.2 2.2 0 0 0 2 4.2v4.6c0 .8.5 1.5 1.2 1.7" />
    </svg>
  );
}

/**
 * 投稿画面URLの表示とコピー（Figmaコメント 1895820976）。
 *
 * 以前は幅いっぱいの1つのボタンで、URLの右端にコピーの文字だけを置いていた。
 * 「コピーボタンも遠いし押しにくい。アイコンもつけて。URL欄ながすぎ」との指摘で直した。
 * **「URL欄ながすぎ」は、欄が間延びしているという意味**（2026-08-23 天真より）。
 * そのため欄は幅いっぱいに伸ばさず、中身の幅に合わせて縮む形にしている（上限340px）。
 * コピーは独立した44pxのボタンにして、すぐ右隣に置いた。
 */
function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex w-full items-center gap-2">
      <p
        className="min-w-0 max-w-[340px] truncate rounded-lg px-3 py-2 text-[12px]"
        style={{ backgroundColor: "var(--product-color-bg-primary)", color: "var(--product-color-text-secondary)" }}
        title={url}
      >
        {url}
      </p>
      <button
        type="button"
        onClick={copy}
        className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border px-3"
        style={{
          borderColor: copied ? "var(--review-accent-primary)" : "var(--product-color-border-default)",
          color: copied ? "var(--review-accent-primary)" : "var(--product-color-text-primary)",
          backgroundColor: "var(--product-color-surface-white)",
        }}
      >
        <CopyIcon />
        <span className="whitespace-nowrap text-[12px] font-bold">{copied ? "コピーしました" : "コピー"}</span>
      </button>
    </div>
  );
}

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

  // ヘッダー右端の差し込み口（SettingsHeader が描画する）。マウント後にしか存在しない
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderSlot(document.getElementById("settings-header-action"));
  }, []);

  return (
    <>
      {/*
        満枠のときも消さずに「押せない状態」で出す（2026-08-23、天真から「ボタンが無い」と
        指摘を受けたため。消えていると移設自体が反映されていないように見える）。
        枠の案内はカード内の「店舗枠がいっぱいです…」が引き受ける。
      */}
      {headerSlot &&
        createPortal(
          <div className="w-fit">
            <ReviewButton variant="primary" onClick={() => setAdding(true)} disabled={!quota.canAddStore}>
              ＋ 店舗を追加
            </ReviewButton>
          </div>,
          headerSlot,
        )}
      <div className="flex w-full flex-col items-start gap-5 rounded-2xl p-6" style={{ backgroundColor: "var(--product-color-surface-white)" }}>
        <SettingsCardTitle icon={<StoreIcon />}>店舗管理</SettingsCardTitle>
        <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
          店舗ごとに Googleマップ上のお店を店名で検索して紐付けます。紐付けると、お客様をクチコミ投稿画面へ直接誘導できます。
          印刷して店舗に置くだけで、アンケートとレビュー送客が始まります
        </p>
        {stores.map((store) => {
          const linked = linkedIds.has(store.id);
          return (
            <div key={store.id} className="flex w-full flex-col items-start gap-3 border-b px-1 py-4" style={{ borderColor: "var(--product-color-border-divider)" }}>
              <div className="flex w-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <p className="text-[13.5px] font-bold" style={{ color: "var(--product-color-text-primary)" }}>
                  {store.name}
                </p>
                <span
                  className="rounded-full px-2 py-1 text-[11px] font-medium"
                  style={{
                    backgroundColor: linked ? "var(--review-accent-wash)" : "var(--product-color-bg-primary)",
                    color: linked ? "var(--review-accent-primary)" : "var(--product-color-status-error)",
                  }}
                >
                  {linked ? "Googleマップ連携済み" : "URL未設定"}
                </span>
              </div>
              <button type="button" onClick={() => setEditingId(store.id)} className="shrink-0 text-[12.5px] font-medium" style={{ color: "var(--review-accent-primary)" }}>
                編集
              </button>
              </div>
              <CopyableUrl url={store.publicUrl} />
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

        {/*
          「＋ 店舗を追加」はPCではページ見出しの右端に置く（2026-08-23、Figmaコメント
          1895968438「このボタンは削除」・1895968468「店舗を追加はこの位置に配置」）。
          SPは見出しが細いので、従来どおりカードの下に残す。
        */}
        {quota.canAddStore ? (
          <div className="w-full md:hidden">
            <ReviewButton variant="primary" onClick={() => setAdding(true)}>
              ＋ 店舗を追加
            </ReviewButton>
          </div>
        ) : (
          <div className="flex w-full flex-col items-start gap-3 rounded-xl p-4" style={{ backgroundColor: "var(--product-color-bg-primary)" }}>
            <p className="text-[12.5px] font-medium" style={{ color: "var(--product-color-text-secondary)" }}>
              {quota.quota === null
                ? "店舗枠を取得できませんでした。時間をおいてページを開き直してください"
                : "店舗枠がいっぱいです。店舗を増やす手続きは、アカウント管理からご案内します"}
            </p>
            {quota.quota !== null && (
              // 線ボタン（2026-08-23、Figmaコメント 1895935256「追加とか決定じゃなくてただの画面遷移なので」）
              <ReviewButton variant="outline" onClick={() => router.push("/admin/settings/billing")}>
                アカウント管理へ
              </ReviewButton>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-4">
        <SettingsCardTitle icon={<StoreIcon />}>二次元コード管理</SettingsCardTitle>
        <div className="hidden w-full flex-wrap items-start gap-4 md:flex">
          {stores.map((store) => (
            <QrCard key={store.id} storeName={store.name} slug={store.slug} qrSvg={store.qrSvg} />
          ))}
        </div>
        <div className="flex w-full flex-col items-start gap-3 md:hidden">
          {stores.map((store) => (
            <QrCardMobile key={store.id} storeName={store.name} slug={store.slug} qrSvg={store.qrSvg} />
          ))}
        </div>
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
