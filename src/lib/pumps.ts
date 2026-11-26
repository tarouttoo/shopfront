import type { Product } from "./catalog";

/**
 * The pump catalog behavior of the approved nasosy page
 * (`reference/project-B/nasosy.html`): type detection, search, series
 * grouping, natural sorting and pagination — all pure, so the island
 * (ProductTable) stays a thin renderer (CODING_STANDARDS: interaction
 * logic is tested in the pure modules, not the rendered App).
 */

/** Pump kinds of the approved source (`detectType` regex cascade). */
export type PumpTypeId =
  | "vertical_multi"
  | "vertical_single"
  | "horizontal_single"
  | "circ"
  | "stations"
  | "stations_fire"
  | "other";

export type PumpTypeFilter = PumpTypeId | "all";
export type SortId = "default" | "name-asc" | "name-desc";

/** The approved source's toolbar select («catalog»), verbatim labels. */
export const PUMP_TYPE_OPTIONS: ReadonlyArray<{
  id: PumpTypeFilter;
  label: string;
}> = [
  { id: "all", label: "Все насосы" },
  { id: "vertical_multi", label: "Вертикальные многоступенчатые" },
  { id: "vertical_single", label: "Вертикальные одноступенчатые" },
  {
    id: "horizontal_single",
    label: "Горизонтальные консольно-моноблочные одноступенчатые",
  },
  { id: "circ", label: "Циркуляционные" },
  { id: "stations", label: "Станции повышения давления" },
  { id: "stations_fire", label: "Станции пожаротушения" },
];

/** The source's sort select minus the price options (no prices in the Catalog). */
export const SORT_OPTIONS: ReadonlyArray<{ id: SortId; label: string }> = [
  { id: "default", label: "Сортировка: по умолчанию" },
  { id: "name-asc", label: "По названию (А–Я)" },
  { id: "name-desc", label: "По названию (Я–А)" },
];

/** The source's price sorts die with the prices — the labels stay out too. */
export const DROPPED_SORT_LABELS = ["Сначала дешевле", "Сначала дороже"] as const;

/** Label of the Spec carrying the series (build-catalog.ts mapping). */
export const SERIES_SPEC_LABEL = "Серия";

export function specValue(product: Product, label: string): string {
  return product.specs.find((spec) => spec.label === label)?.value ?? "";
}

/**
 * The source's `detectType` over description + model + series text;
 * the cascade order decides (пожаротушение beats станция beats …).
 * One deliberate correction to the source: its `/станци/` regex never
 * matches the dataset's «Установка повышения давления» wording (its own
 * filter option showed «Ничего не найдено» for 46% of the catalog), so
 * station detection also keys on the wording the data actually uses.
 */
export function detectPumpType(product: Product): PumpTypeId {
  const text = [product.description, product.name, specValue(product, SERIES_SPEC_LABEL)]
    .join(" ")
    .toLowerCase();
  if (/пожаротуш/.test(text)) return "stations_fire";
  if (/повышен/.test(text) || /станци/.test(text)) return "stations";
  if (/циркуляц/.test(text)) return "circ";
  if (/горизонтал/.test(text)) return "horizontal_single";
  if (/вертикал/.test(text) && /многоступен/.test(text)) return "vertical_multi";
  if (/многоступен/.test(text)) return "vertical_multi";
  if (/одноступен/.test(text)) return "vertical_single";
  return "other";
}

const TYPE_LABELS: Record<PumpTypeId, string> = {
  vertical_multi: "Вертикальный многоступенчатый насос",
  vertical_single: "Вертикальный одноступенчатый насос",
  horizontal_single: "Горизонтальные консольно-моноблочные одноступенчатые насосы",
  circ: `Циркуляционный насос с "мокрым" ротором`,
  stations: "Установка повышения давления",
  stations_fire: "Установка пожаротушения",
  other: "Насос",
};

export function pumpTypeLabel(type: PumpTypeId): string {
  return TYPE_LABELS[type];
}

/**
 * The source's `seriesDisplayName`: a bare designation («BM 1») reads
 * with its type label («Вертикальный многоступенчатый насос BM 1»); a
 * series name that already names the kind («станция …») is kept as is.
 */
export function seriesDisplayName(product: Product, series: string): string {
  const seriesName = (series || product.name).trim();
  const short = pumpTypeLabel(detectPumpType(product));
  if (!seriesName) return short;
  const seriesLow = seriesName.toLowerCase();
  const typeFirstWord = short.toLowerCase().split(" ")[0] ?? "";
  if (
    seriesLow.includes("насос") ||
    seriesLow.includes("станци") ||
    seriesLow.includes(typeFirstWord)
  ) {
    return seriesName;
  }
  return `${short} ${seriesName}`;
}

/** The source's `naturalCompare`: ru locale, numbers inside names numeric. */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
}

/** The approved search: серия, модель (name), артикул (sku), описание. */
export function matchesSearch(product: Product, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    specValue(product, SERIES_SPEC_LABEL).toLowerCase().includes(needle) ||
    product.name.toLowerCase().includes(needle) ||
    product.sku.toLowerCase().includes(needle) ||
    product.description.toLowerCase().includes(needle)
  );
}

/** The source's badge pluralization rule: < 5 → «модели», else «моделей». */
export function modelCountLabel(count: number): string {
  return `${count} ${count < 5 ? "модели" : "моделей"}`;
}

export interface SeriesGroup {
  series: string;
  products: Product[];
}

/**
 * The source's series grouping (key = Серия, fallback model name), the
 * groups ordered naturally by display name — the approved card order.
 */
export function groupBySeries(products: Product[]): SeriesGroup[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const series = specValue(product, SERIES_SPEC_LABEL) || product.name;
    const bucket = groups.get(series);
    if (bucket) bucket.push(product);
    else groups.set(series, [product]);
  }
  return [...groups.entries()]
    .map(([series, groupProducts]) => ({ series, products: groupProducts }))
    .sort((a, b) => {
      const aName = seriesDisplayName(a.products[0]!, a.series);
      const bName = seriesDisplayName(b.products[0]!, b.series);
      return naturalCompare(aName, bName);
    });
}

export function sortProducts(products: Product[], sort: SortId): Product[] {
  const sorted = [...products].sort((a, b) => naturalCompare(a.name, b.name));
  if (sort === "name-desc") sorted.reverse();
  return sorted;
}

export interface PageState {
  page: number;
  pageCount: number;
}

/** 1-based pagination; a page past either end clamps into range. */
export function paginate(requested: number, totalItems: number, size: number): PageState {
  const pageCount = Math.max(1, Math.ceil(totalItems / size));
  return { page: Math.min(Math.max(1, requested), pageCount), pageCount };
}

/** Page slice for the current PageState. */
export function pageSlice<T>(items: T[], state: PageState, size: number): T[] {
  return items.slice((state.page - 1) * size, state.page * size);
}

/**
 * The models-table columns: labels present on at least one model in the
 * list, in first-seen order — the source's `activeSpecs` logic.
 */
export function specColumns(products: Product[]): string[] {
  const columns: string[] = [];
  for (const product of products) {
    for (const spec of product.specs) {
      if (!columns.includes(spec.label)) columns.push(spec.label);
    }
  }
  return columns;
}

export const SERIES_PAGE_SIZE = 12;
export const MODELS_PAGE_SIZE = 20;
