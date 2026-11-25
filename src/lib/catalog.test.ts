import { describe, expect, it } from "vitest";
import { CATEGORIES, PRODUCTS, categoryLabel, findProduct } from "./catalog";

describe("catalog data contract", () => {
  it("loads every Product with a unique SKU", () => {
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

/**
 * Regression for the imported pump dataset (Spec #4, T3): the counts and
 * spot checks below pin the converted source, so a regeneration or edit
 * that silently drops positions fails here instead of shrinking the
 * Catalog unnoticed.
 */
describe("nasosy dataset (5818 imported positions)", () => {
  it("holds exactly the 5818 source positions, all in nasosy", () => {
    expect(PRODUCTS.length).toBe(5818);
    for (const product of PRODUCTS) {
      expect(product.category).toBe("nasosy");
    }
  });

  it("has non-empty unique SKUs for every position", () => {
    for (const product of PRODUCTS) {
      expect(product.sku).toMatch(/\S/);
    }
    expect(new Set(PRODUCTS.map((product) => product.sku)).size).toBe(5818);
  });

  it("spot-checks the first position against the source (sku 1)", () => {
    expect(findProduct("1")).toEqual({
      sku: "1",
      name: "BM 1-2A A-D-E-HQQE",
      category: "nasosy",
      description: "Вертикальный многоступенчатый насос",
      specs: [
        { label: "Серия", value: "BM 1" },
        { label: "Мощность P2, кВт", value: "0,37" },
        { label: "Частота вращения, об/мин", value: "2900" },
        { label: "Напор, м", value: "25" },
        { label: "Напряжение", value: "3x230/400" },
        { label: "Присоединение", value: "DN 25/32" },
      ],
    });
  });

  it("spot-checks the middle position against the source (sku 2910)", () => {
    expect(findProduct("2910")).toEqual({
      sku: "2910",
      name: "HC-ME 4 BME 1-12A G1-B-DD-65-25-A-A",
      category: "nasosy",
      description: "Установка повышения давления",
      specs: [
        { label: "Серия", value: "HC-ME 4 BME" },
        { label: "Мощность P2, кВт", value: "0,75" },
        { label: "Напор, м", value: "25" },
        { label: "Коллекторы", value: "DN 65" },
        { label: "Автоматика", value: "A" },
      ],
    });
  });

  it("spot-checks the last position against the source (sku 5818)", () => {
    expect(findProduct("5818")).toEqual({
      sku: "5818",
      name: "MP 65-190-F-3",
      category: "nasosy",
      description: "Циркуляционный насос с \"мокрым\" ротором",
      specs: [
        { label: "Серия", value: "МР 65" },
        { label: "Напор, м", value: "10" },
        { label: "Напряжение", value: "3x400" },
        { label: "Мощность P1, кВт", value: "540/1479/2314" },
        { label: "Диаметр трубопровода", value: "DN65 PN6/10" },
        { label: "Монтажная длина", value: "340" },
      ],
    });
  });

  it("carries the four GLOSSARY categories for the category pages", () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual([
      "nasosy",
      "kotly",
      "gorelki",
      "avtomatika",
    ]);
    for (const { id, label } of CATEGORIES) {
      expect(categoryLabel(id)).toBe(label);
    }
  });
});
