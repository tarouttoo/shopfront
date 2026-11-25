import { describe, expect, it } from "vitest";
import { PRODUCTS, type Product } from "./catalog";
import {
  PUMP_TYPE_OPTIONS,
  type PumpTypeId,
  SERIES_PAGE_SIZE,
  type SortId,
  detectPumpType,
  groupBySeries,
  matchesSearch,
  modelCountLabel,
  naturalCompare,
  paginate,
  seriesDisplayName,
  sortProducts,
  specColumns,
} from "./pumps";

function pump(overrides: Partial<Product>): Product {
  return {
    sku: "1",
    name: "BM 1-2A A-D-E-HQQE",
    category: "nasosy",
    description: "Вертикальный многоступенчатый насос",
    specs: [{ label: "Серия", value: "BM 1" }],
    ...overrides,
  };
}

describe("pump type detection (approved source detectType)", () => {
  const CASES: ReadonlyArray<[description: string, type: PumpTypeId]> = [
    ["Вертикальный многоступенчатый насос", "vertical_multi"],
    ["Вертикальный одноступенчатый насос", "vertical_single"],
    ["Горизонтальные консольно-моноблочные одноступенчатые насосы", "horizontal_single"],
    ["Установка повышения давления", "stations"],
    ["Установка повышения давления со шкафом управления", "stations"],
    ["Установка пожаротушения", "stations_fire"],
    [`Циркуляционный насос с "мокрым" ротором`, "circ"],
  ];
  for (const [description, type] of CASES) {
    it(`maps «${description}» to ${type}`, () => {
      expect(detectPumpType(pump({ description }))).toBe(type);
    });
  }

  it("detects pressure-boosting units whose wording the source regex missed", () => {
    // The source's /станци/ never matches «Установка повышения давления»
    // — its own filter option showed «Ничего не найдено» for 46% of the
    // catalog. Detection keys on the wording the data actually uses.
    expect(detectPumpType(pump({ description: "Установка повышения давления" }))).toBe(
      "stations",
    );
  });
});

describe("pump dataset regression (5818 positions split by type)", () => {
  it("every position resolves to a known type, matching the source counts", () => {
    const counts = new Map<PumpTypeId, number>();
    for (const product of PRODUCTS) {
      const type = detectPumpType(product);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      vertical_multi: 778,
      vertical_single: 368,
      horizontal_single: 649,
      stations: 2666, // повышения давления: 1631 + со шкафом управления: 1035
      stations_fire: 1343,
      circ: 14,
    });
  });

  it("offers exactly the approved source filter options", () => {
    expect(PUMP_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      "Все насосы",
      "Вертикальные многоступенчатые",
      "Вертикальные одноступенчатые",
      "Горизонтальные консольно-моноблочные одноступенчатые",
      "Циркуляционные",
      "Станции повышения давления",
      "Станции пожаротушения",
    ]);
  });
});

describe("search (Поиск по серии, модели, артикулу…)", () => {
  const product = pump({
    sku: "5818",
    name: "MP 65-190-F-3",
    description: `Циркуляционный насос с "мокрым" ротором`,
    specs: [
      { label: "Серия", value: "МР 65" },
      { label: "Напор, м", value: "10" },
    ],
  });

  it("finds by series, model, sku and description, case-insensitively", () => {
    expect(matchesSearch(product, "МР 65")).toBe(true);
    expect(matchesSearch(product, "мр 65")).toBe(true);
    expect(matchesSearch(product, "MP 65-190")).toBe(true);
    expect(matchesSearch(product, "5818")).toBe(true);
    expect(matchesSearch(product, "ЦИРКУЛЯЦИОННЫЙ")).toBe(true);
  });

  it("ignores empty and whitespace queries", () => {
    expect(matchesSearch(product, "")).toBe(true);
    expect(matchesSearch(product, "   ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesSearch(product, "BM 1")).toBe(false);
    expect(matchesSearch(product, "пожаротушения")).toBe(false);
  });
});

describe("series display name (approved source logic)", () => {
  it("prefixes the type label when the series name is just a designation", () => {
    const vertical = pump({});
    expect(seriesDisplayName(vertical, "BM 1")).toBe("Вертикальный многоступенчатый насос BM 1");
    const circ = pump({ description: `Циркуляционный насос с "мокрым" ротором` });
    expect(seriesDisplayName(circ, "МР 65")).toBe(`Циркуляционный насос с "мокрым" ротором МР 65`);
  });

  it("keeps a series name that already names the kind of equipment", () => {
    const station = pump({ description: "Установка повышения давления" });
    expect(seriesDisplayName(station, "станция Компакт")).toBe("станция Компакт");
  });
});

describe("grouping and sorting", () => {
  const list: Product[] = [
    pump({ sku: "2", name: "BM 1-3A", specs: [{ label: "Серия", value: "BM 1" }] }),
    pump({ sku: "10", name: "BM 1-10A", specs: [{ label: "Серия", value: "BM 1" }] }),
    pump({
      sku: "3",
      name: "MP 65-190-F-3",
      description: `Циркуляционный насос с "мокрым" ротором`,
      specs: [{ label: "Серия", value: "МР 65" }],
    }),
  ];

  it("groups by the Серия spec, falling back to the model name", () => {
    const groups = groupBySeries(list);
    expect(groups.map((group) => group.series)).toEqual(["BM 1", "МР 65"]);
    expect(groups[0]!.products.map((product) => product.sku)).toEqual(["2", "10"]);
  });

  it("sorts series groups naturally by display name", () => {
    const groups = groupBySeries([
      ...list,
      pump({ sku: "4", name: "BM 2-5A", specs: [{ label: "Серия", value: "BM 2" }] }),
    ]);
    expect(groups.map((group) => group.series)).toEqual(["BM 1", "BM 2", "МР 65"]);
  });

  it("natural compare orders numbers inside names numerically", () => {
    expect(["BM 1-10A", "BM 1-2A"].sort(naturalCompare)).toEqual(["BM 1-2A", "BM 1-10A"]);
  });

  it("sorts models by name ascending and descending", () => {
    const asc = sortProducts(list, "name-asc").map((product) => product.name);
    expect(asc).toEqual(["BM 1-3A", "BM 1-10A", "MP 65-190-F-3"]);
    const desc: SortId = "name-desc";
    expect(sortProducts(list, desc).map((product) => product.name)).toEqual(
      [...asc].reverse(),
    );
  });

  it("default order is the natural name order", () => {
    expect(sortProducts([list[1]!, list[0]!], "default").map((p) => p.sku)).toEqual(["2", "10"]);
  });
});

describe("model count badge (approved source pluralization)", () => {
  it("uses «модели» below five and «моделей» from five up", () => {
    expect(modelCountLabel(2)).toBe("2 модели");
    expect(modelCountLabel(4)).toBe("4 модели");
    expect(modelCountLabel(5)).toBe("5 моделей");
    expect(modelCountLabel(847)).toBe("847 моделей");
  });
});

describe("pagination", () => {
  it("counts pages from the total and the page size", () => {
    expect(paginate(1, 98, SERIES_PAGE_SIZE).pageCount).toBe(9);
    expect(paginate(1, 0, SERIES_PAGE_SIZE).pageCount).toBe(1);
  });

  it("clamps the requested page into the valid range", () => {
    expect(paginate(0, 98, SERIES_PAGE_SIZE).page).toBe(1);
    expect(paginate(99, 98, SERIES_PAGE_SIZE).page).toBe(9);
    expect(paginate(3, 40, 20).page).toBe(2);
  });
});

describe("spec columns of a series (approved table header logic)", () => {
  it("lists the spec labels present in at least one model, in first-seen order", () => {
    const columns = specColumns([
      pump({ specs: [{ label: "Серия", value: "BM 1" }, { label: "Напор, м", value: "25" }] }),
      pump({ specs: [{ label: "Серия", value: "BM 1" }, { label: "Напряжение", value: "3x230/400" }] }),
    ]);
    expect(columns).toEqual(["Серия", "Напор, м", "Напряжение"]);
  });

  it("keeps an empty list column-free", () => {
    expect(specColumns([])).toEqual([]);
  });
});
