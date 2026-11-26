import catalogJson from "../data/catalog.json";

/**
 * The Catalog data contract (ADR 0021): build-time JSON, rendered into
 * static HTML. A required key's absence is a rejection, not a default —
 * a broken catalog must fail the build, not silently render empty cards.
 */

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  sku: string;
  name: string;
  category: CategoryId;
  description: string;
  specs: Spec[];
}

/**
 * The four GLOSSARY categories, one page per Category (Насосы, Котлы,
 * Горелки, Автоматика). Only Насосы carries Products so far (Spec #4:
 * the approved automatika position is junk and stays out) — the empty
 * categories exist so their pages and filters resolve.
 */
export type CategoryId = "nasosy" | "kotly" | "gorelki" | "avtomatika";

export const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: "nasosy", label: "Насосы" },
  { id: "kotly", label: "Котлы" },
  { id: "gorelki", label: "Горелки" },
  { id: "avtomatika", label: "Автоматика" },
];

export function categoryLabel(id: CategoryId): string {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`catalog.json: unknown category "${id}"`);
  return found.label;
}

/**
 * A Category is populated when the Catalog carries at least one Product
 * in it (GLOSSARY: Наполненная Категория). Derived from catalog.json —
 * the Catalog data is the only source of truth, so a second populated
 * Category appears here without any island or loader edit.
 */
export function isPopulatedCategory(id: CategoryId): boolean {
  return PRODUCTS.some((product) => product.category === id);
}

export function populatedCategories(): CategoryId[] {
  return CATEGORIES.filter(({ id }) => isPopulatedCategory(id)).map(({ id }) => id);
}

function assertProduct(raw: unknown, index: number): Product {
  const where = `catalog.json[${index}]`;
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${where}: expected an object`);
  }
  const record = raw as Record<string, unknown>;
  const sku = record.sku;
  if (typeof sku !== "string" || sku.length === 0) {
    throw new Error(`${where}: "sku" must be a non-empty string`);
  }
  const name = record.name;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`${where}: "name" must be a non-empty string`);
  }
  const category = record.category;
  if (typeof category !== "string" || !CATEGORIES.some((c) => c.id === category)) {
    throw new Error(`${where}: unknown category "${String(category)}"`);
  }
  const description = record.description;
  if (typeof description !== "string") {
    throw new Error(`${where}: "description" must be a string`);
  }
  const specs = record.specs;
  if (!Array.isArray(specs)) {
    throw new Error(`${where}: "specs" must be an array`);
  }
  return {
    sku,
    name,
    category: category as CategoryId,
    description,
    specs: specs.map((spec, specIndex) => {
      const specWhere = `${where}.specs[${specIndex}]`;
      if (typeof spec !== "object" || spec === null) {
        throw new Error(`${specWhere}: expected an object`);
      }
      const specRecord = spec as Record<string, unknown>;
      if (typeof specRecord.label !== "string" || typeof specRecord.value !== "string") {
        throw new Error(`${specWhere}: "label" and "value" must be strings`);
      }
      return { label: specRecord.label, value: specRecord.value };
    }),
  };
}

export const PRODUCTS: Product[] = catalogJson.map(assertProduct);

export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((product) => product.sku === sku);
}
