import catalogJson from "../data/catalog.json";
import { CATEGORIES, type CategoryId } from "./categories";

/**
 * The Catalog data contract (ADR 0021): build-time JSON, rendered into
 * static HTML. A required key's absence is a rejection, not a default —
 * a broken catalog must fail the build, not silently render empty cards.
 *
 * This module carries the payload (all positions) and the Product
 * data contract they are parsed with, so client modules must not
 * import its payload at runtime: the Category facts they need (ids and
 * labels) live in categories.ts, and the one derived fact they read —
 * which Categories are populated — ships as the build-time
 * `data/populated-categories.json` asset. Re-exports keep the public
 * surface of this module unchanged for the build-side consumers.
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

export { CATEGORIES, categoryLabel } from "./categories";
export type { CategoryId } from "./categories";

/**
 * A Category is populated when the Catalog carries at least one Product
 * in it (GLOSSARY: Наполненная Категория). Derived from catalog.json —
 * the Catalog data is the only source of truth, so a second populated
 * Category appears here without any island or loader edit. The fact
 * crosses to the client as the build-time
 * `data/populated-categories.json` asset (the endpoint derives it from
 * these same functions); this module's payload never enters the page
 * bundles.
 */
export function isPopulatedCategory(id: CategoryId): boolean {
  return PRODUCTS.some((product) => product.category === id);
}

export function populatedCategories(): CategoryId[] {
  return CATEGORIES.filter(({ id }) => isPopulatedCategory(id)).map(({ id }) => id);
}

/**
 * Parse one raw JSON record into a Product or throw. `where` prefixes
 * every error (e.g. "catalog.json[3]", "category JSON [5]"). With
 * expectedCategory the record's category must equal it (per-category
 * asset); without it, the category must be a known CategoryId
 * (full-catalog validation). A violation is a rejection, never a
 * default — the data contract's stated behavior.
 */
export function parseProduct(
  raw: unknown,
  where: string,
  expectedCategory?: CategoryId,
): Product {
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
  if (expectedCategory === undefined) {
    // Full-catalog validation: any known CategoryId is accepted.
    if (typeof category !== "string" || !CATEGORIES.some((c) => c.id === category)) {
      throw new Error(`${where}: unknown category "${String(category)}"`);
    }
  } else if (category !== expectedCategory) {
    // Per-category asset: the record belongs to exactly one Category.
    throw new Error(`${where}: "category" must be "${expectedCategory}"`);
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
    // The guards above proved category is a valid CategoryId (known, or
    // equal to the expected one) — not a fallback.
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

export const PRODUCTS: Product[] = catalogJson.map((raw, index) =>
  parseProduct(raw, `catalog.json[${index}]`),
);

export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((product) => product.sku === sku);
}
