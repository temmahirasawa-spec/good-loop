/**
 * 評価フロー（docs/specs/rating-flow.md）で使うアイコン。
 *
 * 業態テーマ（accent）に連動して色が変わるものはインラインSVGで実装し、
 * `currentColor` ＋ 呼び出し側の `style={{ color: "var(--review-...)" }}` で色を受け取る
 * （app/design-tokens.css / docs/specs/design-rules.md 2-4 の方式）。
 * 業態で色が変わらないものは public/icons/rating-flow/ の静的SVGを <img> で参照する。
 */

export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.2542 6.02083H7.57917C6.71852 6.02083 6.02083 6.71852 6.02083 7.57917V12.9625C6.02083 13.8231 6.71852 14.5208 7.57917 14.5208H12.2542C13.1148 14.5208 13.8125 13.8231 13.8125 12.9625V7.57917C13.8125 6.71852 13.1148 6.02083 12.2542 6.02083Z" stroke="currentColor" strokeWidth="1.34583" />
      <path d="M10.9792 3.89583H4.39167C4.0723 3.89583 3.76602 4.0227 3.54019 4.24853C3.31437 4.47435 3.1875 4.78064 3.1875 5.1V12.0417" stroke="currentColor" strokeWidth="1.34583" strokeLinecap="round" />
    </svg>
  );
}

export function AiSparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 1.875L8.5 5.75L12.375 6.75L8.5 7.75L7.5 11.625L6.5 7.75L2.625 6.75L6.5 5.75L7.5 1.875Z" fill="currentColor" />
      <path d="M11.625 9.625L12.125 11.25L13.75 11.75L12.125 12.25L11.625 13.875L11.125 12.25L9.5 11.75L11.125 11.25L11.625 9.625Z" fill="currentColor" />
    </svg>
  );
}

type ColoredIconProps = { className?: string; style?: React.CSSProperties };

/** accent/primary の円 ＋ accent/on-primary のチェック（業態ごとに黒白が入れ替わる。一律に白で塗らない） */
export function CheckCircleFilledIcon({ className, style }: ColoredIconProps) {
  return (
    <svg className={className} style={style} width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 60C47.464 60 60 47.464 60 32C60 16.536 47.464 4 32 4C16.536 4 4 16.536 4 32C4 47.464 16.536 60 32 60Z" fill="currentColor" />
      <path d="M18.6667 32.8L28 42.1333L45.3333 24" style={{ stroke: "var(--review-accent-on-primary)" }} strokeWidth="5.86667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** accent/primary の円 ＋ accent/on-primary のチェック（04画面のチェックボックス選択状態） */
export function CheckboxCheckedIcon({ className, style }: ColoredIconProps) {
  return (
    <svg className={className} style={style} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.75 2.08333H6.25C3.94881 2.08333 2.08333 3.94881 2.08333 6.25V13.75C2.08333 16.0512 3.94881 17.9167 6.25 17.9167H13.75C16.0512 17.9167 17.9167 16.0512 17.9167 13.75V6.25C17.9167 3.94881 16.0512 2.08333 13.75 2.08333Z" fill="currentColor" />
      <path d="M5.83333 10.1667L8.83333 13.1667L14.3333 7.16667" style={{ stroke: "var(--review-accent-on-primary)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 業態で色が変わらない静的アイコン（public/icons/rating-flow/） ──────────

export function CheckCircleOutlineIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/rating-flow/check-circle-outline.svg" alt="" className={className} />;
}

export function CheckboxUncheckedIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/rating-flow/checkbox-unchecked.svg" alt="" className={className} />;
}

export function PencilIcon({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/rating-flow/pencil.svg" alt="" className={className} />;
}

export function PinIcon({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/rating-flow/pin-${disabled ? "disabled" : "default"}.svg`} alt="" className={className} />;
}

export function RefreshIcon({ className, disabled = false }: { className?: string; disabled?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/rating-flow/refresh-${disabled ? "disabled" : "default"}.svg`} alt="" className={className} />;
}
