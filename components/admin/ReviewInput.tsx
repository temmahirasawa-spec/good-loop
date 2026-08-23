"use client";

/** Review / Input（Figma node 73:1286）— 設定画面・ログイン画面で使う共通の入力欄 */
export function ReviewInput({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
  error?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-12 w-full rounded-xl border bg-[var(--product-color-surface-white)] px-4 text-sm text-[color:var(--product-color-text-primary)] outline-none ${className ?? ""}`}
      style={{
        borderWidth: error ? 1.5 : 1,
        borderColor: error ? "var(--product-color-status-warning)" : "var(--product-color-border-default)",
      }}
    />
  );
}
