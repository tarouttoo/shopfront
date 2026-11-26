import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The harness contract behind the built-output suites (issue #17): one
 * shared build runs in the vitest globalSetup (scripts/test-build.ts)
 * and every built-output suite reads the same dist/. A suite that execs
 * its own build into the shared tree races it mid-prerender — measured
 * flake ~1 in 4 full runs before the globalSetup. Pinned by a source
 * scan, the same seam as typography.test.ts.
 */

const collectTestFiles = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return collectTestFiles(child);
    return entry.name.endsWith(".test.ts") ? [child] : [];
  });

const SELF = new URL("./shared-build.test.ts", import.meta.url);
// This pin's own text names the banned literal, so the scan skips it.
const TEST_FILES = collectTestFiles(new URL("./", import.meta.url)).filter(
  (file) => file.href !== SELF.href,
);

describe("shared build for the built-output suites", () => {
  it("no test suite execs its own astro build", () => {
    const offenders = TEST_FILES.filter((file) =>
      readFileSync(file, "utf8").includes("astro build"),
    ).map((file) => file.pathname);
    expect(offenders).toEqual([]);
  });

  it("vitest wires the shared build as its globalSetup", () => {
    const config = readFileSync(new URL("../vitest.config.ts", import.meta.url), "utf8");
    expect(config).toContain("globalSetup");
    expect(existsSync(new URL("../scripts/test-build.ts", import.meta.url))).toBe(true);
    expect(statSync(new URL("../scripts/test-build.ts", import.meta.url)).isFile()).toBe(true);
  });
});
