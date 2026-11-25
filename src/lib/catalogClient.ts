import type { CategoryId, Product } from "./catalog";
import { withBase } from "./urls";

/**
 * Client-side Catalog loading (ADR 0021): per-category JSON assets are
 * emitted at build time (`src/pages/data/[category].json.ts`) and
 * fetched on demand, so multi-megabyte category data never rides the
 * page bundle or the prerendered HTML. The payload is our own build
 * output, but fetch is an untyped boundary: a malformed record rejects
 * the whole load rather than rendering broken rows (CODING_STANDARDS).
 */

function reject(where: string, message: string): never {
  throw new Error(`category JSON ${where}: ${message}`);
}

function assertRecord(raw: unknown, index: number, category: CategoryId): Product {
  const where = `[${index}]`;
  if (typeof raw !== "object" || raw === null) {
    reject(where, "expected an object");
  }
  const record = raw as Record<string, unknown>;
  const { sku, name, recordCategory, description, specs } = {
    sku: record.sku,
    name: record.name,
    recordCategory: record.category,
    description: record.description,
    specs: record.specs,
  };
  if (typeof sku !== "string" || sku.length === 0) {
    reject(where, '"sku" must be a non-empty string');
  }
  if (typeof name !== "string" || name.length === 0) {
    reject(where, '"name" must be a non-empty string');
  }
  if (recordCategory !== category) {
    reject(where, `"category" must be "${category}"`);
  }
  if (typeof description !== "string") {
    reject(where, '"description" must be a string');
  }
  if (!Array.isArray(specs)) {
    reject(where, '"specs" must be an array');
  }
  return {
    sku,
    name,
    category,
    description,
    specs: specs.map((spec, specIndex) => {
      const specWhere = `${where}.specs[${specIndex}]`;
      if (typeof spec !== "object" || spec === null) {
        reject(specWhere, "expected an object");
      }
      const specRecord = spec as Record<string, unknown>;
      if (typeof specRecord.label !== "string" || typeof specRecord.value !== "string") {
        reject(specWhere, '"label" and "value" must be strings');
      }
      return { label: specRecord.label, value: specRecord.value };
    }),
  };
}

/** Narrow the fetched payload to Products or reject it entirely. */
export function parseCategoryProducts(parsed: unknown, category: CategoryId): Product[] {
  if (!Array.isArray(parsed)) {
    throw new Error("category JSON: expected an array");
  }
  return parsed.map((raw, index) => assertRecord(raw, index, category));
}

/** Fetch one category's build-time JSON asset. */
export async function fetchCategoryProducts(category: CategoryId): Promise<Product[]> {
  const response = await fetch(withBase(`data/${category}.json`));
  if (!response.ok) {
    throw new Error(`category JSON: HTTP ${response.status}`);
  }
  return parseCategoryProducts(await response.json(), category);
}
