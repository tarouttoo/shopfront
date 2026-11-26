/**
 * Client-safe Category facts (GLOSSARY: Категория): ids and labels
 * only — no Catalog payload. Client modules import this module at
 * runtime; the 5818-position dataset stays in catalog.ts, a build-time
 * module whose payload must never enter the page bundles.
 */

/**
 * The four GLOSSARY categories, one page per Category (Насосы, Котлы,
 * Горелки, Автоматика). Only Насосы carries Products so far (Spec #4:
 * the approved automatika position is junk and stays out) — the empty
 * categories exist so their pages and filters resolve.
 */
export type CategoryId = "nasosy" | "kotly" | "gorelki" | "avtomatika";

export const CATEGORIES: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: "nasosy", label: "Насосы" },
  { id: "kotly", label: "Котлы" },
  { id: "gorelki", label: "Горелки" },
  { id: "avtomatika", label: "Автоматика" },
];

export function categoryLabel(id: CategoryId): string {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`catalog.json: unknown category "${id}"`);
  return found.label;
}
