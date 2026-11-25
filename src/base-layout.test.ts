import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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
    // Vitest exports BASE_URL=/ into the environment; an inherited
    // value would override the configured /shopfront base in the child
    // astro build. Build with the environment a real `npm run build`
    // has — no BASE_URL.
    const env = { ...process.env };
    delete env.BASE_URL;
    execSync("npx astro build", { stdio: "pipe", env });
    html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
    // The layout chrome alone: header and footer, excluding whatever
    // page content sits between them (the landing ships in T2).
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
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
    for (const route of ["catalog", "nasosy", "kotly", "gorelki", "avtomatika", "services"]) {
      expect(shell).toContain(`href="/shopfront/${route}/"`);
    }
    expect(shell).toContain(`href="/shopfront/order/"`);
    expect(shell).toContain("Оставить заявку");
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
    for (const page of ["catalog", "order", "services", "privacy"]) {
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
