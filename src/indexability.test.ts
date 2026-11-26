import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

/** Every built page under dist/, depth-first, as absolute paths. */
const htmlFilesUnder = (dir: URL): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return htmlFilesUnder(child);
    return entry.name.endsWith(".html") ? [fileURLToPath(child)] : [];
  });

/**
 * The site is public and indexable (ADR 0022 lifting ADR 0020/0021's
 * until-approval gate): search engines — Yandex first among them, per
 * the ADR 0021 SEO promise — must find the deployed pages. This pins
 * the two gates the draft carried: the `noindex` meta in the base
 * layout and the disallowing robots.txt. Asserting over the built
 * output proves the gate is lifted in what is actually deployed, not
 * only in the sources.
 */
describe("indexability of the built site", () => {
  let htmlFiles: { path: string; html: string }[];
  let robotsTxt: string;
  let sitemapIndex: string;

  beforeAll(() => {
    // dist/ is the shared build from scripts/test-build.ts (the vitest
    // globalSetup) — suites never exec their own.
    const dist = new URL("../dist/", import.meta.url);
    htmlFiles = htmlFilesUnder(dist)
      .map((p) => ({ path: p, html: readFileSync(p, "utf8") }));
    robotsTxt = readFileSync(new URL("robots.txt", dist), "utf8");
    sitemapIndex = readFileSync(new URL("sitemap-index.xml", dist), "utf8");
  });

  it("builds pages at all", () => {
    expect(htmlFiles.length).toBeGreaterThan(0);
  });

  it("contains no noindex meta on any built page", () => {
    const offending = htmlFiles
      .filter(({ html }) => html.includes("noindex"))
      .map(({ path }) => path);
    expect(offending).toEqual([]);
  });

  it("robots.txt allows crawling instead of Disallow: /", () => {
    expect(robotsTxt).toContain("User-agent: *");
    expect(robotsTxt).not.toContain("Disallow: /");
  });

  it("robots.txt points at the generated sitemap", () => {
    const match = robotsTxt.match(/^Sitemap:\s*(\S+)\s*$/m);
    expect(match).not.toBeNull();
    expect(sitemapIndex).toContain("<loc>");
    // The sitemap lives under the deployment base path (astro.config.mjs).
    expect(match![1]).toContain("/shopfront/sitemap");
  });
});
