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

/** 複数選択のチェックマーク（ラジオの丸と取り違えないこと。2026-08-28 天真の指摘） */
export function CheckMarkIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
      <path d="m4.5 10.5 3.6 3.6L15.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
