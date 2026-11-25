import { describe, expect, it } from "vitest";
import { parseCategoryProducts } from "./catalogClient";

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
