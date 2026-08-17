/** 画面下部に出る短い通知（docs/prototypes/ai-visibility-checker.html の .toast） */
export function Toast({ message, shown }: { message: string; shown: boolean }) {
  return (
    <div
      className="pointer-events-none fixed bottom-[var(--product-space-24)] left-1/2 z-50 max-w-[88vw] -translate-x-1/2 rounded-[var(--product-radius-full)] px-[var(--product-space-16)] py-[var(--product-space-12)] text-center text-[13px] font-medium"
      style={{
        backgroundColor: "var(--product-color-text-primary)",
        color: "var(--product-color-text-inverse)",
        opacity: shown ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
