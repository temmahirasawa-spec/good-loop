import type { Config } from "tailwindcss";

/**
 * デザイントークンは Figma Variables（Loop Theme / 9モード）が source of truth。
 * 実装側は app/design-tokens.css の CSS変数を参照する。
 *
 * Tailwind のデフォルトのスケール（spacing / radius など）は、同名で値が違うため
 * **意図的にマージしない**。JSX 側では `p-[var(--space-16)]` のような任意値記法、
 * または style={{ }} で CSS変数を直接参照すること（CLAUDE.md 4章）。
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
