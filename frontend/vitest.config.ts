import { defineConfig } from "vitest/config";

/**
 * Kept separate from vite.config.ts: the project builds on Vite 8 (rolldown) while
 * Vitest carries its own Vite, and merging their plugin types is not worth the
 * friction. Tests need the TSX transform, which esbuild provides from tsconfig's
 * `jsx: react-jsx`; they do not need the React fast-refresh plugin.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
