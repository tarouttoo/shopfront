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
    // The built-output suites read one shared dist/, built once before
    // any file runs by the globalSetup (scripts/test-build.ts) — no
    // suite execs its own build. Files still run sequentially: the
    // pipeline suites spawn child processes and a serialized run keeps
    // their failures attributable.
    globalSetup: ["./scripts/test-build.ts"],
    fileParallelism: false,
  },
});
