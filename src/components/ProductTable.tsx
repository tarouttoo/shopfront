import { useEffect, useMemo, useState } from "react";
import type { Product } from "../lib/catalog";
import { fetchCategoryProducts } from "../lib/catalogClient";
import {
  MODELS_PAGE_SIZE,
  PUMP_TYPE_OPTIONS,
  SERIES_PAGE_SIZE,
  SERIES_SPEC_LABEL,
  SORT_OPTIONS,
  type PageState,
  type PumpTypeFilter,
  type SortId,
  detectPumpType,
  groupBySeries,
  matchesSearch,
  modelCountLabel,
  paginate,
  pageSlice,
  seriesDisplayName,
  sortProducts,
  specColumns,
  specValue,
} from "../lib/pumps";

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; products: Product[] };

const SELECT_CLASS =
  "w-full cursor-pointer appearance-none rounded-[10px] border border-[#d0d5dd] bg-[#f9fafb] px-3.5 py-3 text-sm text-ink focus:border-primary focus:bg-white focus:outline-none md:w-auto";
const CHEVRON_CLASS =
  "pointer-events-none absolute top-1/2 right-3.5 -mt-[3px] h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-ink-light";
const PAGER_BUTTON_CLASS =
  "cursor-pointer rounded-btn border border-primary px-3.5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-40";

function Pager({
  state,
  onPage,
  label,
}: {
  state: PageState;
  onPage: (page: number) => void;
  label: string;
}) {
  if (state.pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="mt-7 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onPage(state.page - 1)}
        disabled={state.page <= 1}
        className={PAGER_BUTTON_CLASS}
      >
        ← Назад
      </button>
      <span className="text-sm text-ink-light">
        Страница {state.page} из {state.pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPage(state.page + 1)}
        disabled={state.page >= state.pageCount}
        className={PAGER_BUTTON_CLASS}
      >
        Вперед →
      </button>
    </nav>
  );
}

/**
 * The nasosy product table island (Spec #4, T4): the approved
 * `reference/project-B/nasosy.html` catalog as a React island —
 * toolbar (type select, search «Поиск по серии, модели, артикулу…»,
 * sort), series cards with pagination, and a per-series models table
 * with «В корзину» actions. Position data loads client-side from the
 * build-time per-category asset (5818 positions never enter the page
 * bundle); search, filters and pagination run fully client-side.
 *
 * The «В корзину» buttons carry `data-add-sku`: the header Cart island
 * (CartButtons) delegates the clicks into the cart reducer and opens
 * the drawer — one cart owner per page, as in T1.
 */
export default function ProductTable() {
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [type, setType] = useState<PumpTypeFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("default");
  const [series, setSeriesState] = useState<string | null>(null);
  const [seriesPage, setSeriesPage] = useState(1);
  const [modelsPage, setModelsPage] = useState(1);

  // Deep link: ?series=<Серия> opens the series' models table, as in
  // the source's nasosy.html?series=… view.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("series");
    if (initial) setSeriesState(initial);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCategoryProducts("nasosy").then(
      (products) => {
        if (!cancelled) setLoad({ phase: "ready", products });
      },
      () => {
        if (!cancelled) setLoad({ phase: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const products = load.phase === "ready" ? load.products : [];

  const filtered = useMemo(() => {
    let list = products;
    if (type !== "all") list = list.filter((product) => detectPumpType(product) === type);
    list = list.filter((product) => matchesSearch(product, query));
    return sortProducts(list, sort);
  }, [products, type, query, sort]);

  const seriesGroups = useMemo(() => groupBySeries(filtered), [filtered]);
  const seriesState = paginate(seriesPage, seriesGroups.length, SERIES_PAGE_SIZE);
  const visibleGroups = pageSlice(seriesGroups, seriesState, SERIES_PAGE_SIZE);

  const models = useMemo(() => {
    if (!series) return [];
    const needle = series.toLowerCase();
    return sortProducts(
      filtered.filter(
        (product) =>
          (specValue(product, SERIES_SPEC_LABEL) || product.name).toLowerCase() === needle,
      ),
      sort,
    );
  }, [filtered, series, sort]);
  const modelsState = paginate(modelsPage, models.length, MODELS_PAGE_SIZE);
  const visibleModels = pageSlice(models, modelsState, MODELS_PAGE_SIZE);
  const columns = useMemo(
    () => specColumns(models).filter((label) => label !== SERIES_SPEC_LABEL),
    [models],
  );

  const setSeries = (next: string | null) => {
    setSeriesState(next);
    setModelsPage(1);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("series", next);
    else url.searchParams.delete("series");
    history.replaceState(null, "", url);
  };

  // A filter change re-runs from the first page.
  useEffect(() => {
    setSeriesPage(1);
  }, [type, query, sort]);

  if (load.phase !== "ready") {
    const error = load.phase === "error";
    return (
      <div className="mx-auto max-w-[1240px] px-5 py-9 pb-10">
        <p className={`mb-3 text-[0.9rem] ${error ? "text-[#c62828]" : "text-ink-light"}`}>
          {error
            ? "Не удалось загрузить каталог. Попробуйте обновить страницу."
            : "Загрузка каталога..."}
        </p>
      </div>
    );
  }

  if (series) {
    // Series view: the toolbar hides (approved source behavior); the
    // models table takes over, paginated.
    const template = ["72px", "minmax(220px, 2fr)"]
      .concat(columns.map(() => "minmax(88px, 0.9fr)"))
      .concat(["118px"])
      .join(" ");
    return (
      <div className="mx-auto max-w-[1240px] px-5 py-9 pb-10">
        <button
          type="button"
          onClick={() => setSeries(null)}
          className="mb-3.5 inline-flex cursor-pointer items-center gap-[7px] border-none bg-transparent p-0 text-sm font-bold text-primary hover:underline"
        >
          ← Все серии насосов
        </button>
        <p className="mb-[18px] text-[0.9rem] text-ink-light">
          Серия <strong className="text-ink">{series}</strong> · моделей: {models.length}
        </p>
        {models.length === 0 ? (
          <div className="rounded-card border border-dashed border-[#c5cdd8] bg-white px-[30px] py-10 text-center">
            <h3 className="mb-2.5 text-[1.2rem] font-bold text-ink">Ничего не найдено</h3>
            <p className="text-ink-light">Измените поиск или выберите другой тип насосов.</p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto rounded-card border border-haze bg-white">
              <div className="w-max min-w-full">
                <div
                  className="grid border-b border-haze bg-[#f3f6fa] max-md:grid-cols-1!"
                  style={{ gridTemplateColumns: template }}
                >
                  <div className="border-r border-[#eef2f6] px-3.5 py-3 text-[0.78rem] leading-tight font-bold text-ink-light max-md:border-r-0">
                    Артикул
                  </div>
                  <div className="border-r border-[#eef2f6] px-3.5 py-3 text-[0.78rem] leading-tight font-bold text-ink-light max-md:border-r-0">
                    Модель
                  </div>
                  {columns.map((label) => (
                    <div
                      key={label}
                      className="border-r border-[#eef2f6] px-3.5 py-3 text-[0.78rem] leading-tight font-bold text-ink-light max-md:border-r-0"
                    >
                      {label}
                    </div>
                  ))}
                  <div className="px-3.5 py-3 max-md:hidden" aria-hidden="true" />
                </div>
                {visibleModels.map((product) => (
                  <div
                    key={product.sku}
                    className="grid border-b border-haze break-words hover:bg-[#f8fbff] max-md:grid-cols-1! max-md:gap-1.5!"
                    style={{ gridTemplateColumns: template }}
                  >
                    <div className="flex items-center border-r border-[#eef2f6] px-3.5 py-3 text-[0.86rem] leading-[1.35] max-md:border-r-0">
                      {product.sku}
                    </div>
                    <div className="flex items-center border-r border-[#eef2f6] px-3.5 py-3 text-[0.86rem] leading-[1.35] font-semibold text-primary-dark max-md:border-r-0">
                      {product.name}
                    </div>
                    {columns.map((label) => (
                      <div
                        key={label}
                        className="flex items-center border-r border-[#eef2f6] px-3.5 py-3 text-[0.86rem] leading-[1.35] max-md:border-r-0"
                      >
                        {specValue(product, label) || "—"}
                      </div>
                    ))}
                    <div className="flex items-center justify-center px-3.5 py-3">
                      <button
                        type="button"
                        data-add-sku={product.sku}
                        className="cursor-pointer rounded-btn border-none bg-primary px-3 py-2 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-primary-dark"
                      >
                        В корзину
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Pager state={modelsState} onPage={setModelsPage} label="Страницы моделей" />
          </>
        )}
      </div>
    );
  }

  // All-series view: toolbar + series cards.
  const typeLabel = PUMP_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? "";
  return (
    <>
      <div className="sticky top-[110px] z-40 border-b border-haze bg-white max-md:static">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-5 py-[18px] max-md:flex-col max-md:items-stretch">
          <div className="relative min-w-[220px] max-md:min-w-full">
            <select
              aria-label="Тип насосов"
              value={type}
              onChange={(event) => setType(event.currentTarget.value as PumpTypeFilter)}
              className={SELECT_CLASS}
            >
              {PUMP_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className={CHEVRON_CLASS} />
          </div>
          <div className="relative min-w-[220px] flex-1 max-md:min-w-full">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-ink-light"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Поиск по серии, модели, артикулу..."
              autoComplete="off"
              aria-label="Поиск по серии, модели, артикулу"
              className="w-full rounded-[10px] border border-[#d0d5dd] bg-[#f9fafb] py-3 pr-3.5 pl-[42px] text-[15px] focus:border-primary focus:bg-white focus:ring-[3px] focus:ring-primary/10 focus:outline-none"
            />
          </div>
          <div className="relative min-w-[220px] max-md:min-w-full">
            <select
              aria-label="Сортировка"
              value={sort}
              onChange={(event) => setSort(event.currentTarget.value as SortId)}
              className={SELECT_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className={CHEVRON_CLASS} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-5 py-9 pb-10">
        <p className="mb-[18px] text-[0.9rem] text-ink-light">
          Показано: <strong className="text-ink">{typeLabel}</strong> · серий:{" "}
          {seriesGroups.length}
        </p>
        {seriesGroups.length === 0 ? (
          <div className="rounded-card border border-dashed border-[#c5cdd8] bg-white px-[30px] py-10 text-center">
            <h3 className="mb-2.5 text-[1.2rem] font-bold text-ink">Ничего не найдено</h3>
            <p className="text-ink-light">Измените поиск или выберите другой тип насосов.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] items-stretch gap-[18px]">
            {visibleGroups.map((group) => {
              const first = group.products[0]!;
              const title = seriesDisplayName(first, group.series);
              const single = group.products.length === 1;
              return (
                <article
                  key={group.series}
                  onClick={single ? undefined : () => setSeries(group.series)}
                  className={`flex h-full min-h-[340px] flex-col overflow-hidden rounded-card border border-haze bg-white transition ${
                    single ? "" : "cursor-pointer hover:-translate-y-[3px] hover:shadow-card"
                  }`}
                >
                  <div className="flex h-[180px] flex-none items-center justify-center bg-white px-3 py-2 text-[0.9rem] text-ink-light">
                    Нет фото
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
                    <h3 className="h-[4.1em] overflow-hidden text-[1.02rem] leading-[1.35] font-bold text-primary-dark">
                      {title}
                    </h3>
                    {!single && (
                      <span className="inline-flex w-fit rounded-full bg-[#e8f4fb] px-2.5 py-[5px] text-[0.8rem] font-bold text-primary">
                        {modelCountLabel(group.products.length)}
                      </span>
                    )}
                    <p className="mt-auto text-[1.15rem] font-extrabold text-primary">
                      Цена по запросу
                    </p>
                    {single ? (
                      <button
                        type="button"
                        data-add-sku={first.sku}
                        className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-btn border-none bg-primary px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
                      >
                        В корзину
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSeries(group.series)}
                        className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-btn border-none bg-primary px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
                      >
                        Смотреть модели
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Pager state={seriesState} onPage={setSeriesPage} label="Страницы серий" />
      </div>
    </>
  );
}
