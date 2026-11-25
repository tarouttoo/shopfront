import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static output, deployed to the GitHub Pages project URL
// https://tarouttoo.github.io/shopfront/ — hence the `base`. The
// deployment workflow (.github/workflows/deploy.yml) publishes every
// merge to main (ADR 0021).
export default defineConfig({
  site: "https://tarouttoo.github.io",
  base: "/shopfront",
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
