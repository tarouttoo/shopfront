import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SITE } from "./data/site";

/**
 * The Services page (Spec #4, T5) ports the approved source
 * `reference/project-B/resheniya.html`: hero intro, «Услуги» cards,
 * «Наши компетенции», FAQ, «Оставить заявку» CTA. Asserted against the
 * built static output — the same seam as the order page FAQ test. The
 * adaptations (page name «Услуги» instead of «Решения под ключ», CTA to
 * /order instead of the Web3Forms lead form, заявка wording in the FAQ)
 * are pinned here so they cannot drift back to the source wording.
 */
describe("services page (built static output)", () => {
  let html: string;

  beforeAll(() => {
    // dist/ is the shared build from scripts/test-build.ts (the vitest
    // globalSetup) — suites never exec their own. Developer comments
    // (Astro keeps them in the output) are not UI: strip them so the
    // asserts see only what a visitor sees.
    html = readFileSync(
      new URL("../dist/services/index.html", import.meta.url),
      "utf8",
    ).replace(/<!--[\s\S]*?-->/g, "");
  });

  const SERVICES = [
    "Генеральный подряд",
    "Монтаж и ПНР",
    "Автоматизация",
    "Сервис и ремонт",
  ];
  const COMPETENCIES = ["Производство НКУ", "Сварка НАКС", "Сервисный центр", "СРО"];
  const FAQ_QUESTIONS = [
    "Какие объекты вы обслуживаете?",
    "Делаете ли вы проектирование?",
    "Можно ли включить в заявку только шкаф управления?",
    "Работаете ли вы за пределами Иркутска?",
  ];

  it("renders the approved sections in source order: intro, услуги, компетенции, FAQ, заявка", () => {
    const intro = html.indexOf("Полный цикл работ");
    const services = html.indexOf("Услуги</h2>");
    const competencies = html.indexOf("Наши компетенции");
    const faq = html.indexOf("Частые вопросы");
    const cta = html.indexOf("Оставить заявку", faq);
    for (const at of [intro, services, competencies, faq, cta]) {
      expect(at).toBeGreaterThan(-1);
    }
    expect(intro).toBeLessThan(services);
    expect(services).toBeLessThan(competencies);
    expect(competencies).toBeLessThan(faq);
    expect(faq).toBeLessThan(cta);
  });

  it("names the page Services («Услуги») — «Решения под ключ» stays a landing-only label", () => {
    expect(html).toContain(`<title>Услуги — ${SITE.name}</title>`);
    expect(html).toContain(">Услуги</h1>");
    expect(html).toContain("Услуги</h2>");
    expect(html).not.toMatch(/решени/i);
  });

  it("renders the four approved service cards and competencies", () => {
    for (const title of [...SERVICES, ...COMPETENCIES]) {
      expect(html).toContain(title);
    }
  });

  it("renders the four FAQ questions in GLOSSARY vocabulary (заявка, never заказ)", () => {
    for (const question of FAQ_QUESTIONS) {
      expect(html).toContain(question);
    }
    expect(html).toContain(
      "шкаф можно включить в заявку отдельно или в составе комплексных работ",
    );
    expect(html).not.toMatch(/заказ/i);
  });

  it("leads the «Оставить заявку» block to the Order Request page, not a lead form", () => {
    expect(html).toContain('href="/shopfront/order/"');
    expect(html).toMatch(/<h3[^>]*>Оставить заявку<\/h3>/);
    // Spec decision 2: no Web3Forms submitter, no key in the repo.
    expect(html).not.toMatch(/web3forms|access_key/i);
  });

  it("renders inside the approved base frame with the shared scroll-top button", () => {
    expect(html).toContain(`tel:${SITE.phones[0].tel}`);
    expect(html).toContain(SITE.copyright);
    expect(html).toContain('id="scroll-top"');
    expect(html).toContain("Наверх");
  });
});
