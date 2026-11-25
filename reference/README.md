# Reference: approved source snapshot

Read-only reference material for the integration Spec (#4). This is a
sanitized copy of the colleague's static site whose landing design,
texts, and content the director approved. It is **not** built, shipped,
or linked from the site — tickets read it to port design, texts, and
data into the Astro app.

Sanitization applied to this copy:

- `Zone.Identifier` Windows ADS files deleted.
- The Web3Forms API key in `cart-order.js` replaced with
  `WEB3FORMS-KEY-STRIPPED` (a credential must not enter the repo).
- `products-avtomatika.js` (a single junk position, description «пало»)
  excluded — the automatika category page is content-only per the Spec.
- `index-v2.html` is kept for provenance only; the approved landing is
  **variant 1** (`index.html`).

Adapt from this copy; never copy files wholesale into `src/`. Stack,
vocabulary, and order-flow rules in the Spec body and ADRs `0021`/`0022`
override whatever the source does differently.
