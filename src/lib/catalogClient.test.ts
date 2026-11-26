import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCategoryProducts, parsePopulatedCategories } from "./catalogClient";

/**
 * The per-category JSON asset crosses an untyped boundary (fetch), so a
 * malformed record rejects the whole load instead of rendering broken
 * rows (CODING_STANDARDS: a required key's absence is a rejection, not
 * a default).
 */
describe("parseCategoryProducts (client-side category JSON)", () => {
  const valid = [
    {
      sku: "1",
      name: "BM 1-2A A-D-E-HQQE",
      category: "nasosy",
      description: "Вертикальный многоступенчатый насос",
      specs: [{ label: "Серия", value: "BM 1" }],
    },
  ];

  it("accepts well-formed category payloads", () => {
    const products = parseCategoryProducts(valid, "nasosy");
    expect(products).toHaveLength(1);
    expect(products[0]).toEqual({
      sku: "1",
      name: "BM 1-2A A-D-E-HQQE",
      category: "nasosy",
      description: "Вертикальный многоступенчатый насос",
      specs: [{ label: "Серия", value: "BM 1" }],
    });
  });

  it("rejects a payload that is not an array", () => {
    expect(() => parseCategoryProducts({ lines: [] }, "nasosy")).toThrow(/array/);
  });

  it("rejects a record without a sku or a name", () => {
    expect(() => parseCategoryProducts([{ name: "x" }], "nasosy")).toThrow(/\[0\].*"sku"/);
    expect(() => parseCategoryProducts([{ sku: "1" }], "nasosy")).toThrow(/\[0\].*"name"/);
  });

  it("rejects a record with malformed specs", () => {
    expect(() =>
      parseCategoryProducts(
        [{ sku: "1", name: "x", category: "nasosy", description: "d", specs: "Серия: BM 1" }],
        "nasosy",
      ),
    ).toThrow(/"specs"/);
  });

  it("rejects a record pointing at another category", () => {
    expect(() => parseCategoryProducts([{ ...valid[0], category: "kotly" }], "nasosy")).toThrow(
      /category/,
    );
  });
});

/**
 * The fact asset's parse boundary: like every fetched asset, a
 * malformed payload is a rejection, not a default — the loader must
 * never guess which Categories are populated.
 */
describe("parsePopulatedCategories (client-side fact asset)", () => {
  it("accepts known category ids, order preserved", () => {
    expect(parsePopulatedCategories(["nasosy", "kotly"])).toEqual(["nasosy", "kotly"]);
  });

  it("rejects a non-array payload", () => {
    expect(() => parsePopulatedCategories({ categories: ["nasosy"] })).toThrow(
      "expected an array of category ids",
    );
  });

  it("rejects a non-string entry", () => {
    expect(() => parsePopulatedCategories(["nasosy", 42])).toThrow(
      "populated-categories.json[1]: expected a category id string",
    );
  });

  it("rejects an unknown id — the Catalog defines what exists", () => {
    expect(() => parsePopulatedCategories(["nasosy", "nobody"])).toThrow(
      'populated-categories.json[1]: unknown category "nobody"',
    );
  });
});

/**
 * loadOrderableProducts: the one orderable dataset per page load (the
 * populated Categories of catalog.json — Насосы today), loaded as the
 * build-time fact asset then each per-category positions asset. fetch
 * stays at this seam and is injected through globalThis; the
 * module-level cache spans a page load, so tests re-import the module
 * per case.
 */
describe("loadOrderableProducts (one fact, one cache)", () => {
  const row = {
    sku: "1",
    name: "BM 1-2A A-D-E-HQQE",
    category: "nasosy",
    description: "Вертикальный многоступенчатый насос",
    specs: [{ label: "Серия", value: "BM 1" }],
  };

  const stubFetch = (handler: (input: RequestInfo | URL) => Promise<unknown>) => {
    const fetchMock = vi.fn(handler);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  /** The build ships the fact asset, then the populated Categories' positions. */
  const stubAssets = (fact: unknown, data: unknown) =>
    stubFetch(async (input) => {
      const url = String(input);
      if (url.includes("populated-categories.json")) {
        return { ok: true, json: async () => fact };
      }
      return { ok: true, json: async () => data };
    });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the Products of every populated Category — and fetches no empty one", async () => {
    const fetchMock = stubAssets(["nasosy"], [row]);
    const { loadOrderableProducts } = await import("./catalogClient");
    await expect(loadOrderableProducts()).resolves.toEqual([row]);
    // Two fetches: the fact asset, then the one populated Category's
    // positions; kotly/gorelki/avtomatika carry no Products and their
    // empty assets stay unloaded.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("populated-categories.json");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("nasosy.json");
  });

  it("rejects on a corrupted fact asset before fetching any positions", async () => {
    const fetchMock = stubAssets(["nasosy", "nobody"], [row]);
    const { loadOrderableProducts } = await import("./catalogClient");
    await expect(loadOrderableProducts()).rejects.toThrow(
      'populated-categories.json[1]: unknown category "nobody"',
    );
    // The fact is parsed first: the positions asset stays unloaded.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("memoizes the resolved promise: a second call resolves without a second load", async () => {
    const fetchMock = stubAssets(["nasosy"], [row]);
    const { loadOrderableProducts } = await import("./catalogClient");
    // The three islands call the loader on one page load; they share
    // the memoized promise — one load, one array instance.
    const [first, second, third] = await Promise.all([
      loadOrderableProducts(),
      loadOrderableProducts(),
      loadOrderableProducts(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2); // fact asset + positions, once
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("a rejected load is not memoized — retry semantics stay with the caller", async () => {
    let failing = true;
    const fetchMock = stubFetch(async (input) => {
      if (failing) throw new Error("network down");
      const url = String(input);
      if (url.includes("populated-categories.json")) {
        return { ok: true, json: async () => ["nasosy"] };
      }
      return { ok: true, json: async () => [row] };
    });
    const { loadOrderableProducts } = await import("./catalogClient");
    await expect(loadOrderableProducts()).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The next call loads again (CartButtons' retry on the next
    // drawer open rides this; a succeeded load would not re-fetch).
    failing = false;
    await expect(loadOrderableProducts()).resolves.toEqual([row]);
    expect(fetchMock).toHaveBeenCalledTimes(3); // fact + positions
  });
});

/**
 * Source pin (shared-build.test.ts style): the islands read the Catalog
 * only through loadOrderableProducts(). A direct fetchCategoryProducts
 * call in an island would fork the fact «which Categories are
 * populated» back into the UI as a literal.
 */
describe("island loader seam (source pin)", () => {
  const collect = (dir: URL): URL[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
      if (entry.isDirectory()) return collect(child);
      return /\.(ts|tsx|astro)$/.test(entry.name) ? [child] : [];
    });

  it("no component under src/components/ calls fetchCategoryProducts", () => {
    const offenders = collect(new URL("../components/", import.meta.url)).filter((file) =>
      readFileSync(file, "utf8").includes("fetchCategoryProducts"),
    );
    expect(offenders.map((file) => file.pathname)).toEqual([]);
  });
});
