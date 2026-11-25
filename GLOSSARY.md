# GLOSSARY

The domain vocabulary of the shopfront. UI text uses the Russian term;
code and docs use the English term. Use exactly these words; no synonyms
in either language. Implementation details live in `docs/adr/` and code,
not here.

- **Shopfront (Витрина)** — the public catalog site: the whole app.
  Until the client approves the project publicly, it exists under the
  codename `shopfront` and the client is never named (ADR `0020`).
- **Client (Заказчик)** — the company owning the Shopfront. Until public
  approval, referred to only as «Заказчик» — no real or brand names
  anywhere in the repo (ADR `0020`).
- **Catalog (Каталог)** — the set of Products the Shopfront offers,
  rendered at build time from data (ADR `0021`).
- **Product (Товар)** — one catalog position: SKU, name, Specs, and
  «Цена по запросу». Products carry no prices on the site.
- **SKU (Артикул)** — the Product's code; the identity used by the Cart
  and the Order Request.
- **Specs (Характеристики)** — a Product's parameter–value pairs, shown
  on its card.
- **Cart (Корзина)** — the collection of Product positions with
  quantities a visitor assembles before ordering. Lives client-side.
- **Order Request (Заявка)** — what the visitor submits from the Cart:
  the collected positions plus contact details. The Client answers it
  with an **Invoice/Quote (Счёт/КП)** issued outside the site. There is
  no online payment and no «заказ» in the retail sense (ADR `0021`).
- **Invoice/Quote (Счёт/КП)** — the commercial document produced from an
  Order Request; not rendered by the site.
- **Price on request (Цена по запросу)** — the only price wording the
  Shopfront uses; never a number, never «купить».
