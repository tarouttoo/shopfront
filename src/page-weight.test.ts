import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/** Every built page (<route>/index.html) under dist/, depth-first.
 * dist/ is the shared build from scripts/test-build.ts (the vitest
 * globalSetup) — suites never exec their own. */
const indexPagesUnder = (dir: URL, root: string): { route: string; path: string }[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return indexPagesUnder(child, root);
    return entry.name === "index.html"
      ? [{ route: fileURLToPath(child).slice(root.length), path: fileURLToPath(child) }]
      : [];
  });

/**
 * Page-weight budget (2026-11-26 retro over PR #12): the 4.7 MB /order
 * page and the 11.1 MB /catalog page were invisible to every gate —
 * Vite warns on JS chunks, nothing watched prerendered HTML. Ceilings
 * live in this one named constant table; a page that legitimately needs
 * more than the default gets an explicit ledger row with a reason.
 * The ledger is empty today: the /catalog removal (ADR 0024) left no
 * page near the ceiling (largest built page 37 KB against 256 KB —
 * about ×6 headroom for the landing's growth).
 */
const PAGE_WEIGHT_BUDGET = {
  /** Ceiling for every prerendered HTML page, in KB. */
  defaultCeilingKb: 256,
  /**
   * Exception ledger: a built page may exceed the default ceiling only
   * by naming its route here with a bigger ceiling and a reason.
   * Routes are relative to the build root (`nasosy/index.html`).
   */
  exceptions: [] as { route: string; ceilingKb: number; reason: string }[],
};

/** The ceiling a route answers to: its ledger row's, else the default. */
const ceilingKbFor = (route: string) =>
  PAGE_WEIGHT_BUDGET.exceptions.find((row) => row.route === route)
    ?.ceilingKb ?? PAGE_WEIGHT_BUDGET.defaultCeilingKb;

/**
 * The budget watches pages, not data: Astro prerenders every route as
 * `<route>/index.html`, while the JSON endpoints land as
 * `data/<category>.json` — the Cart island's fetch targets (2.4 MB of
 * nasosy positions), not documents a visitor or crawler loads as a
 * page. Selecting `index.html` keeps the budget on pages alone.
 */
describe("page-weight budget (built static output)", () => {
  let pages: { route: string; bytes: number }[];

  beforeAll(() => {
    const dist = new URL("../dist/", import.meta.url);
    pages = indexPagesUnder(dist, fileURLToPath(dist)).map(({ route, path }) => ({
      route,
      bytes: statSync(path).size,
    }));
  });

  it("builds pages at all", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("keeps every prerendered HTML page within its ceiling", () => {
    // The report names the ceiling the route actually answers to — a
    // ledgered page that breaches its own (bigger) row must not be
    // told it breached the default.
    const offenders = pages
      .filter(({ route, bytes }) => bytes > ceilingKbFor(route) * 1024)
      .map(
        ({ route, bytes }) =>
          `${route}: ${(bytes / 1024).toFixed(0)} KB (ceiling ${ceilingKbFor(
            route,
          )} KB)`,
      );
    expect(offenders).toEqual([]);
  });

  it("keeps every ledger row pointing at a built page", () => {
    // A stale row (route renamed or removed) would silently exempt
    // nothing forever — fail loudly instead.
    for (const row of PAGE_WEIGHT_BUDGET.exceptions) {
      expect(
        pages.some(({ route }) => route === row.route),
        `ledger row names no built page: ${row.route}`,
      ).toBe(true);
    }
  });

  it("reports page sizes so weight stays visible", () => {
    // The retro's finding was invisibility: print the table every run
    // so growth toward the ceiling shows up in CI logs, not in review.
    const report = [...pages]
      .sort((a, b) => b.bytes - a.bytes)
      .map(({ route, bytes }) => `  ${(bytes / 1024).toFixed(1).padStart(7)} KB  ${route}`)
      .join("\n");
    console.info(`built pages, heaviest first:\n${report}`);
    expect(report.length).toBeGreaterThan(0);
  });
});
