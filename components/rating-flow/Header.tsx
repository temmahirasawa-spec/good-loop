/**
 * 01/02/04画面のヘッダー。
 *
 * Figma（node 49:870 "Logo / Horizontal / Black"）は実店舗（YORKYS BRUNCH）のサンプルロゴを
 * 直接埋め込んだものだが、GOOD REVIEW は多店舗対応で店舗ごとにロゴ画像が異なる。
 * 現状 `stores` テーブル（supabase/0001_rating_flow_schema.sql）にロゴ画像用の列が無いため、
 * 暫定として店舗名のテキスト表示にしている。ロゴアップロード機能を作るセッションで画像に置き換えること。
 */
export function Header({ storeName }: { storeName: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-[var(--product-space-8)]">
      <p
        className="text-center text-base font-bold tracking-[0.16px]"
        style={{ color: "var(--product-color-text-primary)" }}
      >
        {storeName}
      </p>
    </div>
  );
}
