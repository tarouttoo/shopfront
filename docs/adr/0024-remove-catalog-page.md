# The /catalog page is removed

The skeleton shipped it before the robostudio port; the approved source
has no catalog tab — the four category pages carry the product behavior.
ADR `0021`'s promise «a prerendered catalog serves real HTML per
Product» kept the page alive, but with real data the aggregate page
prerendered to an 11.1 MB HTML file (all 5818 Product cards in one
document) that crawlers truncate — failing the SEO purpose the
promise served. This ADR amends that promise: the catalog surface is
the four category pages served from `/data/<category>.json`.

## Consequences

- `src/pages/catalog.astro` is gone, with it the «Каталог» nav item
  (header and footer share one NAV) and its only consumers
  (`ProductCard.astro`, `FilterIsland.tsx` — exports earn their
  consumers).
- The **Catalog** GLOSSARY term stays: the data contract
  (`catalog.json`, `/data/<category>.json`, `src/lib/catalog.ts`) lives
  on — «каталог» in UI text still means the set of Products.
- Links that pointed at the removed route (the OrderForm island's
  empty-cart and success screens) target the populated category page.
- The sitemap lists no `/catalog` URL; the built site has no
  `/catalog` route (pinned by `src/base-layout.test.ts`).
