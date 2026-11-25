/**
 * URL helper for the GitHub Pages project base (ADR 0021): the site
 * lives under `/shopfront/`, so every internal link must be prefixed.
 * Hardcoded absolute paths would work in dev and break in production.
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}
