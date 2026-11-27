import { existsSync, readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SITE } from "./data/site";

/**
 * The base layout (Spec #4, T1) is the approved frame every page
 * renders inside: dark contact top bar, sticky main header with the
 * approved logo and the agreed nav routes, footer with contacts,
 * navigation and legal lines — every identity value read from
 * src/data/site.ts, the approved palette and Inter expressed as
 * Tailwind tokens. Asserted against the built static output (the shell
 * must render with no client JS) — the same seam as the order page
 * FAQ test.
 */
describe("base layout (built static output)", () => {
  let html: string;
  let shell: string;
  let css: string;

  beforeAll(() => {
    // dist/ is the shared build from scripts/test-build.ts (the vitest
    // globalSetup) — suites never exec their own.
    html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
    // The layout chrome alone: header and footer, excluding whatever
    // page content sits between them (each page asserts its own body).
    // The prerendered CartButtons island (client:load) nests its own
    // drawer <header>/<footer> landmarks inside the page header, so the
    // page-level boundaries are resolved past the island's close, not
    // from the first document-wide occurrence.
    const headerStart = html.indexOf("<header");
    const islandClose = html.indexOf("</astro-island>", headerStart);
    const headerEnd = islandClose === -1 ? -1 : html.indexOf("</header>", islandClose);
    const footerStart = islandClose === -1 ? -1 : html.indexOf("<footer", islandClose);
    const footerEnd = footerStart === -1 ? -1 : html.indexOf("</footer>", footerStart);
    // Positional assertions start with presence assertions: a vanished
    // marker would turn the shell slice into a silent partial match.
    for (const at of [headerStart, headerEnd, footerStart, footerEnd, islandClose]) {
      expect(at).toBeGreaterThan(-1);
    }
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(footerEnd).toBeGreaterThan(footerStart);
    const header = html.slice(headerStart, headerEnd);
    const footer = html.slice(footerStart, footerEnd);
    shell = header + footer;
    css = readdirSync(new URL("../dist/_astro/", import.meta.url))
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFileSync(new URL(`../dist/_astro/${file}`, import.meta.url), "utf8"))
      .join("\n")
      .replace(/\s+/g, "");
  });

  it("shows the Client's contacts in the dark top bar, read from site.ts", () => {
    for (const phone of SITE.phones) {
      expect(shell).toContain(`tel:${phone.tel}`);
      expect(shell).toContain(phone.display);
    }
    expect(shell).toContain(`mailto:${SITE.email}`);
    expect(shell).toContain(SITE.email);
    expect(shell).toContain(SITE.addressShort);
  });

  it("renders the approved logo: monogram, brand and tagline", () => {
    expect(shell).toContain(SITE.monogram);
    expect(shell).toContain(SITE.brand);
    expect(shell).toContain(SITE.tagline);
  });

  it("links the agreed routes from the header nav", () => {
    for (const route of ["nasosy", "kotly", "gorelki", "avtomatika", "services"]) {
      expect(shell).toContain(`href="/shopfront/${route}/"`);
    }
    expect(shell).toContain(`href="/shopfront/order/"`);
    expect(shell).toContain("Оставить заявку");
    // The aggregate /catalog page is removed (ADR 0024): the approved
    // design has no catalog tab — neither the header nor the footer
    // (they share one NAV) may link to it.
    expect(shell).not.toContain(`href="/shopfront/catalog/"`);
  });

  it("builds no /catalog route (ADR 0024)", () => {
    expect(existsSync(new URL("../dist/catalog/index.html", import.meta.url))).toBe(false);
  });

  it("prerenders the cart button into the header; the island hydrates client:load, never client:only", () => {
    // A client:only mount leaves the justify-between header row
    // without the button until hydration — the row visibly shifts when
    // the island pops in (the layout shift this pin exists to catch;
    // evidence.md: the HTML pin is what catches client:only islands
    // swallowing static-looking chrome). The button is prerendered
    // from the empty-Cart snapshot (CartButtons: the prerender has no
    // localStorage — ADR 0027), so the badge is absent from the static
    // markup; it is absolutely positioned and moves nothing when the
    // hydrated count brings it in.
    expect(shell).toContain('aria-label="Корзина: 0 — оформить заявку"');
    expect(shell).toContain(">Корзина</span>");
    // Presence before the attribute comparison (no vacuous matching on
    // a vanished island tag).
    const island = shell.match(/<astro-island[^>]*CartButtons[^>]*>/)?.[0] ?? "";
    expect(island).not.toBe("");
    expect(island).toContain('client="load"');
    expect(island).not.toContain('client="only"');
  });

  it("speaks GLOSSARY vocabulary in the shell — заявка, never заказ", () => {
    expect(shell).not.toMatch(/заказ/i);
    expect(shell).toContain("заявк");
  });

  it("footer carries about text, navigation, contacts and legal lines", () => {
    expect(shell).toContain(SITE.name);
    expect(shell).toContain(SITE.about);
    expect(shell).toContain(SITE.address);
    expect(shell).toContain(SITE.workingHours);
    expect(shell).toContain("Навигация");
    expect(shell).toContain("Контакты");
    expect(shell).toContain(SITE.copyright);
    expect(shell).toContain(SITE.inn);
    expect(shell).toContain(SITE.ogrn);
    expect(shell).toContain(`href="/shopfront/${SITE.privacyPath}"`);
  });

  it("renders every existing page inside the same shell", () => {
    for (const page of ["order", "services", "privacy"]) {
      const built = readFileSync(
        new URL(`../dist/${page}/index.html`, import.meta.url),
        "utf8",
      );
      expect(built).toContain(`tel:${SITE.phones[0].tel}`);
      expect(built).toContain(SITE.copyright);
    }
  });

  it("loads Inter via the same Google Fonts link as the source", () => {
    expect(html).toContain(
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    );
  });

  it("compiles the approved palette and tokens into the CSS (Spec §6)", () => {
    for (const token of [
      "#0d47a1",
      "#002171",
      "#5472d3",
      "#00acc1",
      "#00838f",
      "#1a1a2e",
      "#5a5a7a",
      "#f5f7fa",
      "#e8ecf1",
      "#0a1929",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("Inter");
    expect(css).toContain("--radius-card:14px");
  });
});
