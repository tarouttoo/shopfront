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
    const formHeading = html.indexOf("Оформление заявки");
    const faqHeading = html.indexOf("Частые вопросы");
    expect(formHeading).toBeGreaterThan(-1);
    expect(faqHeading).toBeGreaterThan(formHeading);
  });

  it("keeps banned wording («заказ», «оплата на сайте») out of the FAQ block", () => {
    const faqStart = html.indexOf('id="faq"');
    const faqEnd = html.indexOf("</section>", faqStart);
    expect(faqStart).toBeGreaterThan(-1);
    expect(faqEnd).toBeGreaterThan(faqStart);
    const faqBlock = html.slice(faqStart, faqEnd);
    expect(faqBlock).not.toMatch(/заказ|оплата на сайте/);
  });

  it("order page never inlines the catalog — the island fetches the asset", () => {
    // The composition island resolves line names lazily from
    // data/nasosy.json (the Cart drawer's seam). Passing the 5818
    // positions as island props would serialize the whole dataset into
    // the prerendered HTML (~4.7 MB page) — this pins the lazy fetch.
    expect(html).not.toContain("BM 1-2A A-D-E-HQQE");
    expect(html.length).toBeLessThan(100_000);
  });

  it("carries no payment UI anywhere in the page shell", () => {
    // ADR 0021: no online payment. The checkout select («Способ
    // оплаты» / «Оплата картой» / безнал) and its hints must not
    // reappear on the Order Request page.
    expect(html).not.toMatch(/Способ оплаты|Оплата картой|Банковская карта|yoomoney/i);
  });
});

/**
 * The form itself is a client:only island, so it is invisible to the
 * built HTML above. Its wording is pinned at the source level instead:
 * glossary vocabulary (Заявка, never «заказ») and ADR 0021 (no payment
 * wording in the flow).
 */
describe("order form island (component source)", () => {
  const form = readFileSync(new URL("./components/OrderForm.tsx", import.meta.url), "utf8");

  it("speaks glossary vocabulary: заявка, never «заказ»", () => {
    expect(form).not.toMatch(/заказ/i);
    expect(form).toContain("Состав заявки");
    expect(form).toContain("Подтвердить заявку");
    expect(form).toContain("Пожелания к заявке");
  });

  it("stays payment-free (ADR 0021)", () => {
    expect(form).not.toMatch(/оплат/i);
  });

  it("mirrors the source field set, consent text and success screen", () => {
    expect(form).toContain("Тип покупателя");
    expect(form).toContain("ФИО");
    expect(form).toContain("Контактное лицо");
    expect(form).toContain("Название организации");
    expect(form).toContain("ИНН");
    expect(form).toContain("Телефон");
    expect(form).toContain("Email");
    expect(form).toContain("Комментарий");
    expect(form).toContain("политикой конфиденциальности");
    expect(form).toContain("Заявка отправлена менеджеру");
    expect(form).toContain("Заявка принята");
  });
});
