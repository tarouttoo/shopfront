import { CATEGORIES, type CategoryId } from "./categories";

/**
 * The Product data contract (GLOSSARY: Товар) — field rules and the one
 * parser both adapters execute: catalog.ts at build time (catalog.json)
 * and catalogClient.parseCategoryProducts at runtime (the per-category
 * JSON assets). Payload-free by design, like categories.ts: client
 * modules import this module without shipping the Catalog payload
 * (ADR 0021); catalog.ts re-exports the contract as its own surface
 * (ADR 0024). A violation is a rejection, never a default — a broken
 * catalog must fail the build, not silently render empty cards.
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
 * Validate the category field and return it as the typed CategoryId, so
 * the compiler (not an assertion) carries the invariant. With
 * expectedCategory the record's category must equal it (per-category
 * asset: the record belongs to exactly one Category); without, it must
 * be a known CategoryId (full-catalog validation).
 */
function parseCategoryField(
  category: unknown,
  where: string,
  expectedCategory?: CategoryId,
): CategoryId {
  if (expectedCategory !== undefined) {
    if (category !== expectedCategory) {
      throw new Error(`${where}: "category" must be "${expectedCategory}"`);
    }
    return expectedCategory;
  }
  const known =
    typeof category === "string"
      ? CATEGORIES.find(({ id }) => id === category)
      : undefined;
  if (!known) {
    throw new Error(`${where}: unknown category "${String(category)}"`);
  }
  return known.id;
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
  const category = parseCategoryField(record.category, where, expectedCategory);
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
    category,
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
