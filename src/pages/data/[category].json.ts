import type { APIRoute } from "astro";
import { CATEGORIES, PRODUCTS, type CategoryId } from "../../lib/catalog";

/**
 * Per-category Catalog assets (ADR 0021 + Spec #4 T4): the category
 * island fetches its category's JSON client-side instead of inlining
 * ~2 MB of positions into the page bundle, so the static shell paints
 * instantly. Static file endpoints emit `dist/data/<category>.json`;
 * the payload is the same validated catalog.json the build reads —
 * filtered by category, order preserved.
 */
export function getStaticPaths() {
  return CATEGORIES.map((category) => ({ params: { category: category.id } }));
}

export const GET: APIRoute = ({ params }) => {
  const category = params.category as CategoryId;
  const products = PRODUCTS.filter((product) => product.category === category);
  return new Response(JSON.stringify(products), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
