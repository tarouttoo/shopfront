import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { PRODUCTS } from "./lib/catalog";

/**
 * The category pages (Spec #4, T4) asserted against the built static
 * output — the same seam as the base-layout and order-page tests:
 *
 * - /nasosy: the approved build-time shell (page hero) plus the
 *   client:only island mount; the 5818-position dataset ships as the
 *   per-category JSON asset (never inlined into the page bundle);
 * - /kotly, /gorelki, /avtomatika: content shells with the graceful
 *   «скоро» empty state — no product table, no toolbar;
 * - the cart drawer is ported from cart-order.js with GLOSSARY wording
 *   (Корзина, заявка; prices never render).
 */
describe("category pages (built static output)", () => {
  let nasosy: string;
  let kotly: string;
  let gorelki: string;
  let avtomatika: string;
  let dataJson: string;

  beforeAll(() => {
    // Vitest exports BASE_URL=/ into the environment; an inherited
    // value would override the configured /shopfront base in the child
    // astro build. Build with the environment a real `npm run build`
    // has — no BASE_URL.
    const env = { ...process.env };
    delete env.BASE_URL;
    execSync("npx astro build", { stdio: "pipe", env });
    nasosy = readFileSync(new URL("../dist/nasosy/index.html", import.meta.url), "utf8");
    kotly = readFileSync(new URL("../dist/kotly/index.html", import.meta.url), "utf8");
    gorelki = readFileSync(new URL("../dist/gorelki/index.html", import.meta.url), "utf8");
    avtomatika = readFileSync(
      new URL("../dist/avtomatika/index.html", import.meta.url),
      "utf8",
    );
    dataJson = readFileSync(new URL("../dist/data/nasosy.json", import.meta.url), "utf8");
  });

  it("nasosy renders the approved hero in the static shell", () => {
    expect(nasosy).toContain("<title>Насосы — ООО ИТЦ «Альтер Энерго»</title>");
    expect(nasosy).toContain("Насосное оборудование. Подбор под задачу.");
  });

  it("nasosy mounts the product-table island and the scroll-top furniture", () => {
    expect(nasosy).toMatch(/astro-island[^>]*component-url="[^"]*ProductTable/);
    expect(nasosy).toContain('id="scroll-top"');
    expect(nasosy).toContain("Наверх");
  });

  it("nasosy page bundle never inlines the catalog — the island fetches the asset", () => {
    // The prerendered HTML must stay small: no product row in the page.
    expect(nasosy).not.toContain("BM 1-2A A-D-E-HQQE");
    const islandUrls = [...nasosy.matchAll(/component-url="([^"]+)"/g)].map((m) => m[1]!);
    expect(islandUrls.some((url) => /CartButtons/.test(url))).toBe(true);
    // The per-category asset carries the full dataset instead.
    const data = JSON.parse(dataJson) as Array<{ sku: string; name: string }>;
    expect(data).toHaveLength(PRODUCTS.length);
    expect(data[0]).toMatchObject({ sku: PRODUCTS[0]!.sku, name: PRODUCTS[0]!.name });
    // Prices never enter the Catalog assets (GLOSSARY: Цена по запросу).
    expect(dataJson).not.toContain('"price"');
  });

  it.each([
    {
      name: "kotly",
      html: () => kotly,
      title: "Котлы",
      subtitle: "Отопительное оборудование для котельных и ИТП.",
    },
    {
      name: "gorelki",
      html: () => gorelki,
      title: "Горелки",
      subtitle: "Газовые, дизельные и комбинированные горелки.",
    },
    {
      name: "avtomatika",
      html: () => avtomatika,
      title: "Автоматика",
      subtitle: "Контроллеры, ПЛК, КИПиА и шкафы управления.",
    },
  ])("$name renders the approved hero and the «скоро» empty state", ({ html: read, title, subtitle }) => {
    const html = read();
    expect(html).toContain(`<h1 class="mb-2 text-[2rem] leading-tight font-extrabold">${title}</h1>`);
    expect(html).toContain(subtitle);
    expect(html).toContain("Каталог скоро появится");
    expect(html).toContain("Позиции этого раздела готовятся к публикации");
    expect(html).toContain('href="/shopfront/order/"');
    expect(html).toContain("Оставить заявку");
  });

  it("empty categories ship no product table and no toolbar", () => {
    for (const html of [kotly, gorelki, avtomatika]) {
      expect(html).not.toMatch(/astro-island[^>]*component-url="[^"]*ProductTable/);
      expect(html).not.toContain('type="search"');
      // The scroll-top furniture stays.
      expect(html).toContain('id="scroll-top"');
    }
  });

  it("category pages speak GLOSSARY vocabulary — заявка, never заказ", () => {
    for (const html of [nasosy, kotly, gorelki, avtomatika]) {
      expect(html).not.toMatch(/заказ/i);
      expect(html).not.toMatch(/купить/i);
    }
  });
});
