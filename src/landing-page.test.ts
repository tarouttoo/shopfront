import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { SITE } from "./data/site";

/**
 * The landing (Spec #4, T2) is a faithful port of the approved variant 1
 * (`reference/project-B/index.html`): hero with count-up stats, the four
 * direction cards (approved labels, agreed routes), the About block and
 * the Contacts block with the Yandex map and the contact form. The form's
 * submitter is a local stub — the source posted to Web3Forms, which must
 * not enter the repo (Spec decision 2). Asserted against the built static
 * output — the same seam as the base-layout and order-FAQ tests.
 */
describe("landing page (built static output)", () => {
  let html: string;
  let built: string; // prerendered HTML + every emitted JS chunk

  beforeAll(() => {
    // Vitest exports BASE_URL=/ into the environment; an inherited value
    // would override the configured /shopfront base in the child build.
    const env = { ...process.env };
    delete env.BASE_URL;
    execSync("npx astro build", { stdio: "pipe", env });
    html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
    built = [
      html,
      ...readdirSync(new URL("../dist/_astro/", import.meta.url))
        .filter((file) => file.endsWith(".js"))
        .map((file) =>
          readFileSync(new URL(`../dist/_astro/${file}`, import.meta.url), "utf8"),
        ),
    ].join("\n");
  });

  it("carries the approved title and description", () => {
    expect(html).toContain("<title>");
    expect(html).toContain("Теплоэнергетика и инженерные системы");
    expect(html).toContain(SITE.description);
  });

  it("renders the hero: approved title, subtitle and the consultation CTA", () => {
    expect(html).toContain("Инженерные решения для теплоэнергетики");
    expect(html).toContain(
      "Поставка оборудования, производство НКУ, проектирование, монтаж, пусконаладка и сервис. Работаем с Истратех, ОВЕН и другими производителями.",
    );
    const cta = html.indexOf("Получить консультацию");
    expect(cta).toBeGreaterThan(-1);
    // The source CTA points at the contacts block on the same page.
    expect(html.slice(0, cta)).toContain('href="#contacts"');
  });

  it("renders the four stat cards with the count-up targets", () => {
    expect(html).toContain('data-target="19"');
    expect(html).toContain('data-target="2007"');
    for (const label of [
      "лет на рынке",
      "год основания",
      "100%",
      "российский фокус",
      "СРО",
      "два допуска",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("renders the direction cards with approved labels and the agreed routes", () => {
    const cards = [
      {
        num: "01",
        label: "Насосы",
        copy: "Истратех и другое насосное оборудование",
        href: "/shopfront/nasosy/",
      },
      {
        num: "02",
        label: "Автоматика",
        copy: "ОВЕН, ПЛК, КИПиА",
        href: "/shopfront/avtomatika/",
      },
      {
        num: "03",
        label: "Котлы и горелки",
        copy: "Отопительное оборудование для котельных и ИТП",
        href: "/shopfront/kotly/",
      },
      {
        num: "04",
        label: "Решения под ключ",
        copy: "Проектирование, монтаж, ПНР, сервис",
        href: "/shopfront/services/",
      },
    ];
    for (const card of cards) {
      // Anchor on the card's unique copy: the labels also occur in the
      // header/footer navigation rendered before the cards.
      const at = html.indexOf(card.copy);
      expect(at, card.copy).toBeGreaterThan(-1);
      const cardHtml = html.slice(Math.max(0, at - 900), at);
      expect(cardHtml).toContain(card.num);
      expect(cardHtml).toContain(card.label);
      expect(cardHtml).toContain(`href="${card.href}"`);
    }
  });

  it("renders the About block as in the approved source", () => {
    for (const text of [
      "О компании",
      SITE.name,
      "Инженерно-технический центр с опытом работы с 2007 года. Иркутск и Иркутская область.",
      "Мы специализируемся на комплексных решениях в области теплоэнергетики и промышленной автоматизации.",
      "СРО (Строительство)",
      "Допуск к работам по договорам подряда",
      "СРО (Проектирование)",
      "Разработка проектной документации",
      "Ключевые направления",
      "Автоматизация котельных и ИТП",
      "Внедрение систем диспетчеризации",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("embeds the Yandex map widget read from site.ts", () => {
    // Attribute values render entity-escaped; the browser decodes back to
    // exactly the site.ts URL.
    expect(html).toContain(`src="${SITE.mapEmbedUrl.replaceAll("&", "&amp;")}"`);
    expect(html).toContain("Карта:");
    expect(html).toMatch(/loading="lazy"/);
  });

  it("shows the Client's contacts read from site.ts", () => {
    expect(html).toContain("Свяжитесь с нами");
    expect(html).toContain(SITE.address);
    for (const phone of SITE.phones) {
      expect(html).toContain(`tel:${phone.tel}`);
      expect(html).toContain(phone.display);
    }
    expect(html).toContain(`mailto:${SITE.email}`);
    expect(html).toContain(SITE.workingHours);
    expect(html).toContain("Режим работы");
  });

  it("renders the contact form with the agreement link to the privacy policy", () => {
    for (const text of [
      "Оставить заявку",
      "Ваше имя *",
      "Телефон *",
      "Email",
      "Комментарий",
      "Иван Иванов",
      "Согласен на обработку персональных данных и принимаю",
      "политику конфиденциальности",
      "Отправить",
      'id="form-message"',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain(`href="/shopfront/${SITE.privacyPath}"`);
  });

  it("keeps the source section order: hero → directions → about → contacts", () => {
    const hero = html.indexOf("Инженерные решения для теплоэнергетики");
    const directions = html.indexOf("Истратех и другое насосное оборудование");
    const about = html.indexOf("Ключевые направления");
    const contacts = html.indexOf("Свяжитесь с нами");
    expect(hero).toBeGreaterThan(-1);
    expect(directions).toBeGreaterThan(hero);
    expect(about).toBeGreaterThan(directions);
    expect(contacts).toBeGreaterThan(about);
  });

  it("wires the client behaviors of the source: count-up, reveal, scroll-top, form stub", () => {
    expect(built).toContain("data-target");
    expect(built).toContain("IntersectionObserver");
    expect(built).toContain("scroll-top");
    expect(built).toContain("aria-label=\"Наверх\"");
    // The stub submitter's messages, as approved minus the network call.
    expect(built).toContain("Заполните: ");
    expect(built).toContain("Заявка отправлена! Мы свяжемся с вами.");
  });

  it("speaks GLOSSARY vocabulary — no «заказ» anywhere on the landing", () => {
    expect(html).not.toMatch(/заказ/i);
  });

  it("ships no Web3Forms submitter, no payment wording, no stripped key", () => {
    expect(built).not.toContain("api.web3forms.com");
    expect(built).not.toContain("f055fbbd"); // the stripped source key
    expect(html).not.toMatch(/оплат|купить/i);
  });
});
