import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SITE } from "./data/site";

/**
 * The Privacy policy page (Spec #4, T5) ports the approved source
 * `reference/project-B/privacy.html`: white content card, sections 1–6,
 * date line. Asserted against the built static output — the same seam
 * as the order page FAQ test. Identity strings must come from
 * src/data/site.ts (Spec decision 1), and the GLOSSARY vocabulary must
 * hold on a legal page too.
 */
describe("privacy page (built static output)", () => {
  let html: string;

  beforeAll(() => {
    // dist/ is the shared build from scripts/test-build.ts (the vitest
    // globalSetup) — suites never exec their own. Developer comments
    // (Astro keeps them in the output) are not UI: strip them so the
    // asserts see only what a visitor sees.
    html = readFileSync(
      new URL("../dist/privacy/index.html", import.meta.url),
      "utf8",
    ).replace(/<!--[\s\S]*?-->/g, "");
  });

  const SECTIONS = [
    "1. Общие положения",
    "2. Какие данные мы собираем",
    "3. Цели сбора персональных данных",
    "4. Как мы защищаем ваши данные",
    "5. Права Пользователя",
    "6. Контакты",
  ];

  it("renders the approved title and all six sections", () => {
    expect(html).toContain("<title>Политика конфиденциальности — ИТЦ Альтер Энерго</title>");
    expect(html).toContain(">Политика конфиденциальности</h1>");
    for (const section of SECTIONS) {
      expect(html).toContain(section);
    }
    expect(html).toContain("Дата последнего обновления: 2026 год.");
  });

  it("names the Operator and the site domain from site.ts in the intro", () => {
    expect(html).toContain(`${SITE.name} (далее — Оператор)`);
    // The space before the domain survives the Astro whitespace collapse.
    expect(html).toContain(`сайта <strong>${SITE.domain}</strong>`);
  });

  it("carries the Operator's contacts from site.ts in section 6 and the rights notice", () => {
    // Both links live in the page content (section 5.1 and section 6);
    // the base frame carries its own mailto links outside <main>.
    const mainStart = html.indexOf("<main");
    const mainEnd = html.indexOf("</main>");
    // Positional assertions start with presence assertions: a vanished
    // marker would reshape the slice instead of failing loudly.
    expect(mainStart).toBeGreaterThan(-1);
    expect(mainEnd).toBeGreaterThan(mainStart);
    const main = html.slice(mainStart, mainEnd);
    expect(main.split(`mailto:${SITE.email}`)).toHaveLength(3);
    expect(html).toContain(`Телефон: ${SITE.phones[0].display}`);
    expect(html).toContain(`Адрес: ${SITE.address}`);
  });

  it("keeps the GLOSSARY vocabulary (ответ на заявку, never заказ)", () => {
    expect(html).toContain("ответ на заявку");
    expect(html).not.toMatch(/заказ/i);
  });

  it("renders inside the approved base frame with the shared scroll-top button", () => {
    expect(html).toContain(`tel:${SITE.phones[0].tel}`);
    expect(html).toContain(SITE.copyright);
    expect(html).toContain('id="scroll-top"');
    expect(html).toContain("Наверх");
  });
});
