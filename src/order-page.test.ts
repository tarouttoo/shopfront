import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The order page's FAQ is static Astro content, not an island (ADR 0021:
 * React only for the genuinely interactive parts). A client:only island
 * vanishes from the prerendered HTML, so asserting the FAQ text inside
 * the built page proves it renders in the static build with no client
 * JS. Wording is pinned to GLOSSARY.md vocabulary (Заявка, Счёт/КП,
 * Цена по запросу) — the FAQ block must not drift into retail-speak.
 */
describe("order page FAQ (built static output)", () => {
  let html: string;

  beforeAll(() => {
    execSync("npx astro build", { stdio: "pipe" });
    html = readFileSync(
      new URL("../dist/order/index.html", import.meta.url),
      "utf8",
    );
  });

  const FAQ_QUESTIONS = [
    "Что происходит после отправки заявки?",
    "Есть ли онлайн-оплата?",
    "Почему цены указаны как «по запросу»?",
    "Можно ли включить в заявку одну позицию?",
  ];

  it("renders the four recurring questions", () => {
    for (const question of FAQ_QUESTIONS) {
      expect(html).toContain(question);
    }
  });

  it("answers inside the GLOSSARY vocabulary (Счёт/КП, по счёту)", () => {
    expect(html).toContain("выставляем счёт или КП по составу заявки");
    expect(html).toContain("после согласования, по счёту");
    expect(html).toContain("итоговую стоимость фиксирует счёт");
    expect(html).toContain("заявка собирается из любых позиций каталога");
  });

  it("sits below the form section", () => {
    expect(html.indexOf("Частые вопросы")).toBeGreaterThan(
      html.indexOf("Оформление заявки"),
    );
  });

  it("keeps banned wording («заказ», «оплата на сайте») out of the FAQ block", () => {
    const faqStart = html.indexOf('id="faq"');
    expect(faqStart).toBeGreaterThan(-1);
    const faqBlock = html.slice(faqStart, html.indexOf("</section>", faqStart));
    expect(faqBlock).not.toMatch(/заказ|оплата на сайте/);
  });
});
