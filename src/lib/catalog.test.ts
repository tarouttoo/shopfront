import { describe, expect, it } from "vitest";
import { PRODUCTS, categoryLabel, findProduct } from "./catalog";

describe("catalog data contract", () => {
  it("loads every placeholder Product with a unique SKU", () => {
    const skus = PRODUCTS.map((product) => product.sku);
    expect(skus.length).toBeGreaterThan(0);
    expect(new Set(skus).size).toBe(skus.length);
    for (const sku of skus) {
      expect(findProduct(sku)).toBeDefined();
    }
  });

  it("every Product has at least one Spec", () => {
    for (const product of PRODUCTS) {
      expect(product.specs.length).toBeGreaterThan(0);
    }
  });

  it("resolves every category label", () => {
    for (const product of PRODUCTS) {
      expect(categoryLabel(product.category)).toMatch(/\S/);
    }
  });

  it("rejects an unknown SKU", () => {
    expect(findProduct("НЕТ-ТАКОГО")).toBeUndefined();
  });
});
