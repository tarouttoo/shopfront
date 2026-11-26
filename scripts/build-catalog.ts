/**
 * Converts the approved pump dataset (Spec #4, T3) into the Catalog data
 * file. Run manually via `npm run catalog:build` — never part of the
 * Astro build (ADR 0021: the site reads catalog.json at build time; this
 * script is the feeder that regenerates it from the read-only source
 * snapshot).
 *
 * Source: `reference/project-B/products-nasosy.js` — one line defining
 * `window.AE_NASOSY_PRODUCTS` as a JSON-compatible array literal. The
 * payload after the assignment is parsed as JSON, not eval'd.
 *
 * Mapping (Ticket #6):
 * - `sku` verbatim (the Артикул the approved UI searches by); `model`
 *   becomes the name — real designations are public since ADR 0022;
 * - the source's `price` («по запросу») is deliberately dropped: prices
 *   never enter the Catalog (GLOSSARY: «Цена по запросу» is rendered,
 *   not stored); the empty `image` column is dropped for the same reason;
 * - every other non-empty source field becomes a Spec in the display
 *   order below — «Серия» leads, matching the approved search placeholder
 *   «Поиск по серии, модели, артикулу…».
 */
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE_PATH = "reference/project-B/products-nasosy.js";
const TARGET_PATH = "src/data/catalog.json";

/** Assignment marker the array literal is extracted from. */
const ARRAY_MARKER = "window.AE_NASOSY_PRODUCTS";

/** The source record; every field is a string, empty when absent. */
interface SourcePump {
  id: string;
  series: string;
  model: string;
  sku: string;
  price: string;
  image: string;
  description: string;
  power_p2: string;
  rpm: string;
  pressure: string;
  voltage: string;
  ports: string;
  port_in: string;
  port_out: string;
  construction: string;
  collectors: string;
  automation: string;
  power_p1: string;
  pipe_size: string;
  mount_length: string;
}

/** Source field → RU spec label, in display order (Ticket #6). */
const SPEC_FIELDS: ReadonlyArray<readonly [keyof SourcePump, string]> = [
  ["series", "Серия"],
  ["power_p2", "Мощность P2, кВт"],
  ["rpm", "Частота вращения, об/мин"],
  ["pressure", "Напор, м"],
  ["voltage", "Напряжение"],
  ["ports", "Присоединение"],
  ["port_in", "Вход"],
  ["port_out", "Выход"],
  ["power_p1", "Мощность P1, кВт"],
  ["pipe_size", "Диаметр трубопровода"],
  ["mount_length", "Монтажная длина"],
  ["construction", "Конструкция"],
  ["collectors", "Коллекторы"],
  ["automation", "Автоматика"],
];

interface CatalogProduct {
  sku: string;
  name: string;
  category: "nasosy";
  description: string;
  specs: Array<{ label: string; value: string }>;
}

function readSourcePumps(path: string): SourcePump[] {
  const source = readFileSync(path, "utf8");
  const markerAt = source.indexOf(ARRAY_MARKER);
  if (markerAt === -1) {
    throw new Error(`${path}: no "${ARRAY_MARKER}" assignment found`);
  }
  const start = source.indexOf("[", markerAt);
  const end = source.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${path}: array literal after "${ARRAY_MARKER}" not found`);
  }
  const parsed: unknown = JSON.parse(source.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error(`${path}: payload is not an array`);
  }
  return parsed as SourcePump[];
}

function toProduct(pump: SourcePump, index: number): CatalogProduct {
  const where = `${SOURCE_PATH}[${index}] (sku ${JSON.stringify(pump.sku)})`;
  if (typeof pump.sku !== "string" || pump.sku.trim().length === 0) {
    throw new Error(`${where}: empty "sku"`);
  }
  if (typeof pump.model !== "string" || pump.model.trim().length === 0) {
    throw new Error(`${where}: empty "model"`);
  }
  if (typeof pump.description !== "string" || pump.description.trim().length === 0) {
    throw new Error(`${where}: empty "description"`);
  }
  const specs = SPEC_FIELDS.map(([field, label]) => ({ label, value: pump[field] })).filter(
    (spec) => spec.value.trim().length > 0,
  );
  if (specs.length === 0) {
    throw new Error(`${where}: every source field mapped to a Spec is empty`);
  }
  return {
    sku: pump.sku,
    name: pump.model,
    category: "nasosy",
    description: pump.description,
    specs,
  };
}

const pumps = readSourcePumps(SOURCE_PATH);
const products = pumps.map(toProduct);

const skus = new Set(products.map((product) => product.sku));
if (skus.size !== products.length) {
  throw new Error(`${SOURCE_PATH}: duplicate "sku" values — SKU is the Product identity`);
}

writeFileSync(TARGET_PATH, `${JSON.stringify(products, null, 2)}\n`);
console.log(`Wrote ${products.length} Products to ${TARGET_PATH}`);
