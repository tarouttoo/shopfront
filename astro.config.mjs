import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// Static output, deployed to the GitHub Pages project URL
// https://tarouttoo.github.io/shopfront/ — hence the `base`. The
// deployment workflow (.github/workflows/deploy.yml) publishes every
// merge to main (ADR 0021).
export default defineConfig({
  site: "https://tarouttoo.github.io",
  base: "/shopfront",
  output: "static",
  // Built-output test suites exec `astro build`; vitest runs the test
  // files sequentially (fileParallelism: false in vitest.config.ts), so
  // sharing one dist/ is safe for them. Suites that need their own tree
  // (the indexability suite scans every built HTML file) isolate
  // themselves via SITE_OUT_DIR (indexability scans every built HTML
  // file, page-weight every built page); the default stays the deploy dir.
  outDir: process.env.SITE_OUT_DIR ?? "dist",
  // The site is public and indexable (ADR 0022): the sitemap gives the
  // search engines the full page list to crawl. Built into
  // dist/sitemap-index.xml under `site` + `base`; robots.txt points at it.
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
