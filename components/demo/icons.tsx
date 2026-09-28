/** プロトタイプ専用のアイコン（docs/specs/survey-v2.md 段1）。本番採用時に rating-flow/icons.tsx へ移す */

export function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12.5 16 6.5 10l6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 音声入力（機能は後段。場所を先に確保する。2026-08-28 天真） */
export function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <rect x={7.25} y={2.25} width={5.5} height={9.5} rx={2.75} strokeLinejoin="round" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3" strokeLinecap="round" />
    </svg>
  );
}

export function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <rect x={5} y={5} width={10} height={10} rx={2} />
    </svg>
  );
}

/**
 * Googleマップのピン。形は rating-flow の PinIcon と同じだが、**線の色は文字色（currentColor）に従う**。
 * PinIcon は線が #1A1A1A の画像なので、v5 の墨のボタンの上では見えなかった（2026-09-28、Figma に写したときに発見）。
 */
export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.34583} aria-hidden>
      <path d="M8.5 1.7C5.66667 1.7 3.4 3.96667 3.4 6.8C3.4 10.625 8.5 15.3 8.5 15.3C8.5 15.3 13.6 10.625 13.6 6.8C13.6 3.96667 11.3333 1.7 8.5 1.7Z" strokeLinejoin="round" />
      <path d="M8.5 8.64167C9.51712 8.64167 10.3417 7.81712 10.3417 6.8C10.3417 5.78288 9.51712 4.95833 8.5 4.95833C7.48288 4.95833 6.65833 5.78288 6.65833 6.8C6.65833 7.81712 7.48288 8.64167 8.5 8.64167Z" />
    </svg>
  );
}

/**
 * 丸にチェック（v5 の完了・停止中のお知らせ）。形は rating-flow の CheckCircleOutlineIcon と同じで、
 * **線の色は文字色（currentColor）に従う**（あちらは線が #999999 の画像。Figma は text/tertiary）。
 */
export function CheckCircleIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden>
      <path d="M32 60C47.464 60 60 47.464 60 32C60 16.536 47.464 4 32 4C16.536 4 4 16.536 4 32C4 47.464 16.536 60 32 60Z" strokeWidth={4.8} />
      <path d="M18.6667 32.8L28 42.1333L45.3333 24" strokeWidth={5.86667} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 複数選択のチェックマーク（ラジオの丸と取り違えないこと。2026-08-28 天真の指摘） */
export function CheckMarkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
      <path d="m4.5 10.5 3.6 3.6L15.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
