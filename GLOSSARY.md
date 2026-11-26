# GLOSSARY

The domain vocabulary of the shopfront. UI text uses the Russian term;
code and docs use the English term. Use exactly these words; no synonyms
in either language. Implementation details live in `docs/adr/` and code,
not here.

- **Shopfront (Витрина)** — the public catalog site: the whole app.
- **Client (Заказчик)** — the company owning the Shopfront: ООО ИТЦ
  «Альтер Энерго» (ADR `0022`).
- **Catalog (Каталог)** — the set of Products the Shopfront offers,
  rendered at build time from data (ADR `0021`).
- **Category (Категория)** — a named grouping of Products; the Catalog
  has one page per Category (Насосы, Котлы, Горелки, Автоматика).
- **Services (Услуги)** — the works the Client performs
  (проектирование, монтаж и ПНР, автоматизация, сервис): content pages,
  never Products and never orderable. «Решения под ключ» is only the
  approved landing label linking to the Services page, not a term —
  avoid «Решения» as a word for this concept.
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

## Typography

Russian UI text quotes with «…». Inside an outer «…» quote the inner
quote uses „…“ — never a second « (pinned by `src/typography.test.ts`).
