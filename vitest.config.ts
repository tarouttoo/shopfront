import { defineConfig } from "vitest/config";

/**
 * Test discovery at the repo root, independent of the Astro Vite root:
 * pipeline tests (.sandcastle) and product tests (src) run in a plain
 * node environment. The cart logic is tested in its pure module per
 * CODING_STANDARDS ("interaction logic is tested in the reducers, not
 * the rendered App"), so no DOM environment is needed.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", ".sandcastle/**/*.test.ts", "docs/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
