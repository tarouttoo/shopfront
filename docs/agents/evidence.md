# Evidence: what pins what

The Shopfront is a static Astro build (ADR `0021`): content is
prerendered HTML, interactivity lives in a few React islands. Test where
a failure would actually show.

## Content pins through the prerendered HTML

A change to page content — sections, wording, section order, glossary
conformance — is pinned by an assertion over the built site: `npm run
build`, then assert against `dist/**/index.html`. This is the only pin
that catches a `client:only` island silently swallowing what should be
static, a wrong section order, and banned vocabulary in the final
markup. Canonical example: `src/order-page.test.ts`.

## Behavior pins through modules and components

Cart math, catalog lookup, and form logic get unit tests on their
modules (`src/lib/*.test.ts`) or component tests — not assertions over
rendered HTML they do not affect.

## Screenshots only when a capture script exists

The repo ships no screenshot script: the Electron evidence convention
the factory grew up with does not apply to a static site
(`implement/prompt.md` captures only when
`scripts/evidence-screenshot.mjs` exists). For a content change, the
built HTML is the evidence.
