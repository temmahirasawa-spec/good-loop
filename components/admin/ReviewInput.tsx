"use client";

/**
 * Review / Input（Figma node 73:1286）— 設定画面・ログイン画面で使う共通の入力欄
 *
 * `autoCapitalize` / `autoComplete` / `spellCheck` は打ち方の指定だけで、**見た目は変えない**
 * （2026-10-01、招待コードの欄で使うために足した。指定しなければ従来どおり）。
 */
export function ReviewInput({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  className,
  autoCapitalize,
  autoComplete,
  spellCheck,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  error?: boolean;
  className?: string;
  autoCapitalize?: string;
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      className={`h-12 w-full rounded-xl border bg-[var(--product-color-surface-white)] px-4 text-sm text-[color:var(--product-color-text-primary)] outline-none ${className ?? ""}`}
      style={{
        borderWidth: error ? 1.5 : 1,
        borderColor: error ? "var(--product-color-status-warning)" : "var(--product-color-border-default)",
      }}
    />
  );
}
