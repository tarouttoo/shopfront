import catalogJson from "../data/catalog.json";
import { CATEGORIES, type CategoryId } from "./categories";
import { parseProduct, type Product } from "./product";

/**
 * The Catalog data contract (ADR 0021): build-time JSON, rendered into
 * static HTML. A required key's absence is a rejection, not a default —
 * a broken catalog must fail the build, not silently render empty cards.
 *
 * This module carries the payload (all positions), so client modules
 * must not import it at runtime. The Product contract the payload is
 * parsed with (the Product/Spec types and parseProduct) is payload-free
 * in product.ts and re-exported here — this module is the carrier of
 * the Catalog data contract (ADR 0024). The Category facts client
 * modules need (ids and labels) live in categories.ts, and the one
 * derived fact they read — which Categories are populated — ships as
 * the build-time `data/populated-categories.json` asset. Re-exports
 * keep the public surface of this module unchanged for the build-side
 * consumers.
 */

export { parseProduct, type Product, type Spec } from "./product";

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

export const PRODUCTS: Product[] = catalogJson.map((raw, index) =>
  parseProduct(raw, `catalog.json[${index}]`),
);

export function findProduct(sku: string): Product | undefined {
  return PRODUCTS.find((product) => product.sku === sku);
}
