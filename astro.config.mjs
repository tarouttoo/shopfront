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
  // Built-output test suites exec `astro build` in parallel vitest
  // workers; building into one shared dist/ makes them race (one build
  // wipes the other's .prerender entries). Each suite isolates itself
  // via SITE_OUT_DIR, the default stays the deploy dir.
  outDir: process.env.SITE_OUT_DIR ?? "dist",
  // The site is public and indexable (ADR 0022): the sitemap gives the
  // search engines the full page list to crawl. Built into
  // dist/sitemap-index.xml under `site` + `base`; robots.txt points at it.
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
