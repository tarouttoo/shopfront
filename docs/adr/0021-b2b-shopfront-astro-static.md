# B2B shopfront on static Astro

The product is a **B2B shopfront**: a catalog of Products with specs and
"price on request", a Cart that collects positions, and an **Order
Request** — the customer's contact details plus the collected positions,
answered by the client with an invoice/quote. There is no online
payment, no acquiring, no personal accounts: this was settled against the
client's own pitch material, which promises exactly the B2B shape
("cart and online payment are not needed — we are not retail").

## Stack: Astro + React islands + Tailwind, fully static

- **Static output on GitHub Pages.** SEO is a core promise of the pitch
  (Yandex must find the site); a prerendered catalog serves real HTML
  per Product, while a React SPA would index poorly and Next.js SSR
  would demand a Node host. Pages is free and deploys from Actions —
  the factory's merge updates the preview within minutes.
- **React islands** for the genuinely interactive parts (Cart, catalog
  filter, Order Request form); everything else stays static Astro.
- **Tailwind CSS** as the styling base, adopted before any wayfinding,
  so later decisions do not re-layout.
- **Catalog data is JSON in the repo** at build time. A headless CMS
  (Directus/Strapi) and a server-side intake for Order Requests
  (PDF spec sheet, CRM lead, email/Telegram) are deliberate *non-decisions*
  for now: both require a hosted server, which does not exist before the
  client approves the budget. They are wayfinder territory, decided on
  the map — including the CMS choice itself.

## Alternatives rejected

- **Next.js** — its server need buys nothing while there is no
  server-side feature; revisit only if Order Request intake moves
  in-house (SSR + API routes) after wayfinding says so.
- **Vite + React SPA** — best-known stack, but a client-rendered catalog
  undermines the SEO promise the whole project stands on.
- **Tilda-class constructor** — out: the pitch argues against it
  (catalog with filters, code stays with the client).

## Consequences

- The Order Request form ships with a stub submitter (validation only,
  success screen, no network call). Where requests actually land —
  email, Telegram, CRM — is a wayfinder decision, not a silent choice
  made here.
- Until the client approves: `noindex` meta and a disallowing
  `robots.txt`, and placeholder Products with neutral names only —
  no real client, brand, or product names (ADR `0020`).
