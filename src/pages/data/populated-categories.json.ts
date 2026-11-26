import type { APIRoute } from "astro";
import { populatedCategories } from "../../lib/catalog";

/**
 * The populated-Categories fact as a build-time asset (GLOSSARY:
 * Наполненная Категория): the ids of the Categories carrying at least
 * one Product, derived by `populatedCategories()` from catalog.json —
 * the same functions the tests pin. The client loader
 * (`loadOrderableProducts()`) reads this tiny asset instead of
 * importing catalog.ts, whose 5818-position payload must never enter
 * the page bundles (the per-category assets carry the payload, Spec
 * #4 T4).
 */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(populatedCategories()), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
