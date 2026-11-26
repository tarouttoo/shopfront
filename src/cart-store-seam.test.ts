import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Deletion pins for the Cart store seam (ADR 0027, T1): the retired
 * seams — the `data-add-sku` DOM delegation, the per-island Cart state
 * owners, `ModalLine` — must be gone from the sources, not merely
 * unused. Source-level scans in the `src/shared-build.test.ts` style.
 */

const SELF = new URL("./cart-store-seam.test.ts", import.meta.url);
const SRC = new URL("./", import.meta.url);

const sourceFiles = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(ts|tsx|astro)$/.test(entry.name) && child.href !== SELF.href ? [child] : [];
  });

const offenders = (files: URL[], needle: string): string[] =>
  files
    .filter((file) => readFileSync(file, "utf8").includes(needle))
    .map((file) => file.pathname);

const component = (name: string): string =>
  readFileSync(new URL(`./components/${name}`, import.meta.url), "utf8");

describe("cart store seam deletions (ADR 0027)", () => {
  it("data-add-sku is deleted from src/", () => {
    expect(offenders(sourceFiles(SRC), "data-add-sku")).toEqual([]);
  });

  it("ModalLine is deleted from src/", () => {
    expect(offenders(sourceFiles(SRC), "ModalLine")).toEqual([]);
  });

  it("no island runs its own Cart state owner: no useReducer, no saveCart under src/components/", () => {
    const islands = sourceFiles(new URL("./components/", import.meta.url));
    expect(offenders(islands, "useReducer")).toEqual([]);
    expect(offenders(islands, "saveCart")).toEqual([]);
  });

  it("ProductTable stays publish-only: it dispatches but never subscribes", () => {
    const text = component("ProductTable.tsx");
    expect(text).not.toContain("subscribe");
    expect(text).not.toContain("useSyncExternalStore");
    expect(text).toContain('dispatch({ type: "add", sku');
  });

  it("OrderForm clears through the store's one write path, never saveCart", () => {
    const text = component("OrderForm.tsx");
    expect(text).toContain('dispatch({ type: "clear" })');
    expect(text).not.toContain("saveCart");
  });
});
