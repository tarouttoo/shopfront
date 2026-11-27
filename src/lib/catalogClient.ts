import { CATEGORIES, type CategoryId } from "./categories";
import { parseProduct, type Product } from "./product";
import { withBase } from "./urls";

/**
 * Client-side Catalog loading (ADR 0021): per-category JSON assets are
 * emitted at build time (`src/pages/data/[category].json.ts`) and
 * fetched on demand, so multi-megabyte category data never rides the
 * page bundle or the prerendered HTML. The payload is our own build
 * output, but fetch is an untyped boundary: a malformed record rejects
 * the whole load rather than rendering broken rows (CODING_STANDARDS).
 */

/** Narrow the fetched payload to Products or reject it entirely. Record
 *  validation is the Product contract's job — parseProduct, defined
 *  payload-free in product.ts (the client-safe import target: catalog.ts
 *  carries the contract, ADR 0024, but holds the payload, so a runtime
 *  import from here would ship the Catalog to visitors). Each record
 *  parses with this adapter's prefix and the asset's Category. */
export function parseCategoryProducts(parsed: unknown, category: CategoryId): Product[] {
  if (!Array.isArray(parsed)) {
    throw new Error("category JSON: expected an array");
  }
  return parsed.map((raw, index) => parseProduct(raw, `category JSON [${index}]`, category));
}

/** Fetch one category's build-time JSON asset (module-private: the
 *  loader below is the only consumer — islands read the Catalog
 *  through `loadOrderableProducts()`). */
async function fetchCategoryProducts(category: CategoryId): Promise<Product[]> {
  const response = await fetch(withBase(`data/${category}.json`));
  if (!response.ok) {
    throw new Error(`category JSON: HTTP ${response.status}`);
  }
  return parseCategoryProducts(await response.json(), category);
}

/**
 * The populated-Categories fact as the build ships it
 * (`dist/data/populated-categories.json`, emitted by the endpoint from
 * catalog.json's one derived fact): the ids of the Categories carrying
 * at least one Product (GLOSSARY: Наполненная Категория). Parsed like
 * every fetched asset — a non-array payload, a non-string entry or an
 * unknown id is a rejection, not a default; the Catalog defines what
 * exists.
 */
export function parsePopulatedCategories(parsed: unknown): CategoryId[] {
  if (!Array.isArray(parsed)) {
    throw new Error("populated-categories.json: expected an array of category ids");
  }
  return parsed.map((raw, index) => {
    const where = `populated-categories.json[${index}]`;
    if (typeof raw !== "string") {
      throw new Error(`${where}: expected a category id string`);
    }
    if (!CATEGORIES.some(({ id }) => id === raw)) {
      throw new Error(`${where}: unknown category "${raw}"`);
    }
    return raw as CategoryId; // the membership guard above proves the id
  });
}

/** Fetch the build-time populated-Categories fact asset. */
async function fetchPopulatedCategories(): Promise<CategoryId[]> {
  const response = await fetch(withBase("data/populated-categories.json"));
  if (!response.ok) {
    throw new Error(`populated-categories JSON: HTTP ${response.status}`);
  }
  return parsePopulatedCategories(await response.json());
}

/**
 * Load the Products of every populated Category (GLOSSARY: Наполненная
 * Категория; one orderable dataset today: Насосы). Two-stage: the tiny
 * build-time fact asset names the populated Categories, then each
 * Category's positions load from its per-category asset — the Catalog
 * payload of catalog.ts never enters the page bundles. Per-page cache:
 * the module memoizes the resolved promise, so the three islands share
 * one load per page — and one array instance. A duplicated island
 * chunk may hold its own cache copy: a duplicate load of identical
 * data, harmless. A rejected load is not memoized: the promise rejects
 * and the next call fetches again, so retry semantics stay with the
 * caller (each island keeps its own failure presentation).
 */
let orderable: Promise<Product[]> | null = null;

export function loadOrderableProducts(): Promise<Product[]> {
  if (!orderable) {
    orderable = fetchPopulatedCategories()
      .then((categories) =>
        Promise.all(categories.map((category) => fetchCategoryProducts(category))),
      )
      .then(
        (parts) => parts.flat(),
        (error: unknown) => {
          orderable = null;
          throw error;
        },
      );
  }
  return orderable;
}
