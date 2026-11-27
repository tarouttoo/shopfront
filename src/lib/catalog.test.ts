import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  PRODUCTS,
  categoryLabel,
  findProduct,
  isPopulatedCategory,
  parseProduct,
  populatedCategories,
} from "./catalog";

/** A record the contract accepts — the fixtures below mutate one field. */
const goodRecord = {
  sku: "1",
  name: "BM 1-2A A-D-E-HQQE",
  category: "nasosy",
  description: "Вертикальный многоступенчатый насос",
  specs: [{ label: "Серия", value: "BM 1" }],
};

/**
 * THE Product data contract (GLOSSARY: Товар), pinned once here through
 * parseProduct — the one validator both adapters delegate to (the
 * build-time catalog.json import and the client-side per-category asset
 * fetch). A violation is a rejection, never a default; `where` prefixes
 * every error so the failing position is named.
 */
describe("parseProduct (the Product data contract)", () => {
  it("returns the Product for a well-formed record", () => {
    expect(parseProduct(goodRecord, "catalog.json[0]")).toEqual(goodRecord);
  });

  it("rejects a record that is not an object", () => {
    expect(() => parseProduct("BM 1", "catalog.json[3]")).toThrow(
      "catalog.json[3]: expected an object",
    );
    expect(() => parseProduct(null, "catalog.json[3]")).toThrow(
      "catalog.json[3]: expected an object",
    );
  });

  it("rejects a missing or empty sku", () => {
    expect(() => parseProduct({ ...goodRecord, sku: undefined }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "sku" must be a non-empty string',
    );
    expect(() => parseProduct({ ...goodRecord, sku: "" }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "sku" must be a non-empty string',
    );
  });

  it("rejects a missing or empty name", () => {
    expect(() => parseProduct({ ...goodRecord, name: "" }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "name" must be a non-empty string',
    );
    expect(() => parseProduct({ ...goodRecord, name: 42 }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "name" must be a non-empty string',
    );
  });

  it("full-catalog mode: the category must be a known CategoryId", () => {
    for (const { id } of CATEGORIES) {
      expect(parseProduct({ ...goodRecord, category: id }, "catalog.json[3]")).toMatchObject({
        category: id,
      });
    }
    expect(() => parseProduct({ ...goodRecord, category: "nobody" }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: unknown category "nobody"',
    );
  });

  it("per-category mode: the record's category must equal expectedCategory", () => {
    expect(
      parseProduct({ ...goodRecord, category: "nasosy" }, "category JSON [5]", "nasosy"),
    ).toMatchObject({ category: "nasosy" });
    expect(() =>
      parseProduct({ ...goodRecord, category: "kotly" }, "category JSON [5]", "nasosy"),
    ).toThrow('category JSON [5]: "category" must be "nasosy"');
    // A non-string category fails the same equality — there is no
    // "unknown category" escape from the per-category asset.
    expect(() => parseProduct({ ...goodRecord, category: 42 }, "category JSON [5]", "nasosy")).toThrow(
      'category JSON [5]: "category" must be "nasosy"',
    );
  });

  it("rejects a non-string description", () => {
    expect(() => parseProduct({ ...goodRecord, description: 42 }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "description" must be a string',
    );
  });

  it("rejects specs that are not an array", () => {
    expect(() => parseProduct({ ...goodRecord, specs: "Серия: BM 1" }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "specs" must be an array',
    );
    expect(() => parseProduct({ ...goodRecord, specs: undefined }, "catalog.json[3]")).toThrow(
      'catalog.json[3]: "specs" must be an array',
    );
  });

  it("rejects a spec entry that is not an object", () => {
    expect(() =>
      parseProduct({ ...goodRecord, specs: [{ label: "Серия", value: "BM 1" }, "BM 1"] }, "catalog.json[3]"),
    ).toThrow('catalog.json[3].specs[1]: expected an object');
  });

  it("rejects a spec pair with a non-string label or value", () => {
    expect(() =>
      parseProduct({ ...goodRecord, specs: [{ label: "Серия", value: 1 }] }, "catalog.json[3]"),
    ).toThrow('catalog.json[3].specs[0]: "label" and "value" must be strings');
    expect(() =>
      parseProduct({ ...goodRecord, specs: [{ label: 1, value: "BM 1" }] }, "catalog.json[3]"),
    ).toThrow('catalog.json[3].specs[0]: "label" and "value" must be strings');
  });

  it("keeps only the string label/value pairs and the typed category", () => {
    // Extra keys on the record or on a spec entry are dropped: the
    // contract's shape is exactly Product.
    expect(
      parseProduct(
        { ...goodRecord, extra: "junk", specs: [{ label: "Серия", value: "BM 1", junk: true }] },
        "catalog.json[3]",
      ),
    ).toEqual({ ...goodRecord, specs: [{ label: "Серия", value: "BM 1" }] });
  });
});

describe("catalog data contract (PRODUCTS built through parseProduct)", () => {
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
 * The fact «which Categories are populated» (GLOSSARY: Наполненная
 * Категория): derived from catalog.json here, so no island, page or
 * loader keeps a second literal list to drift away from the data.
 */
describe("populated Categories", () => {
  it("derives the populated Categories from the Catalog data alone", () => {
    // The dataset pins put all 5818 positions into nasosy; the other
    // three pages show the «Каталог скоро появится» empty state.
    expect(populatedCategories()).toEqual(["nasosy"]);
  });

  it("a Category is populated exactly when the Catalog carries a Product in it", () => {
    for (const { id } of CATEGORIES) {
      expect(isPopulatedCategory(id)).toBe(PRODUCTS.some((p) => p.category === id));
    }
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
