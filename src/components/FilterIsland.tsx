import { useEffect, useState } from "react";
import { CATEGORIES, type CategoryId } from "../lib/catalog";

/**
 * Client-side filter over the static catalog grid: the cards are real
 * prerendered HTML (SEO, ADR 0021); the island only hides and shows
 * them by their data attributes.
 */
export default function FilterIsland() {
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-product-card]");
    const needle = query.trim().toLowerCase();
    for (const card of cards) {
      const matchesCategory = category === "all" || card.dataset.category === category;
      const matchesQuery = needle.length === 0 || (card.dataset.name ?? "").includes(needle);
      card.classList.toggle("hidden", !(matchesCategory && matchesQuery));
    }
  }, [category, query]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <select
        aria-label="Категория"
        value={category}
        onChange={(event) => setCategory(event.currentTarget.value as CategoryId | "all")}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="all">Все категории</option>
        {CATEGORIES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        aria-label="Поиск по названию"
        placeholder="Поиск по названию"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
      />
    </div>
  );
}
