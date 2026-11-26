import type { Product } from "./catalog";

/**
 * The Cart (Корзина, GLOSSARY.md): client-side collection of Product
 * positions with quantities. Interaction logic lives in the pure
 * `cartReducer`, tested directly — not in the rendered islands
 * (CODING_STANDARDS). Persistence degrades explicitly: a malformed
 * stored Cart resets to empty (the visitor's own storage, no invariant
 * worth trapping them on), and that behavior is pinned by tests.
 */

export interface CartLine {
  sku: string;
  qty: number;
}

export interface Cart {
  lines: CartLine[];
}

export const EMPTY_CART: Cart = { lines: [] };

export const CART_STORAGE_KEY = "shopfront.cart.v1";

export type CartAction =
  | { type: "add"; sku: string }
  | { type: "setQty"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "clear" };

export function addToCart(cart: Cart, sku: string): Cart {
  const existing = cart.lines.find((line) => line.sku === sku);
  if (existing) {
    return {
      lines: cart.lines.map((line) =>
        line.sku === sku ? { ...line, qty: line.qty + 1 } : line,
      ),
    };
  }
  return { lines: [...cart.lines, { sku, qty: 1 }] };
}

export function setQty(cart: Cart, sku: string, qty: number): Cart {
  if (!Number.isInteger(qty) || qty < 0) return cart;
  if (qty === 0) {
    return { lines: cart.lines.filter((line) => line.sku !== sku) };
  }
  return {
    lines: cart.lines.map((line) => (line.sku === sku ? { ...line, qty } : line)),
  };
}

export function removeFromCart(cart: Cart, sku: string): Cart {
  return { lines: cart.lines.filter((line) => line.sku !== sku) };
}

export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add":
      return addToCart(cart, action.sku);
    case "setQty":
      return setQty(cart, action.sku, action.qty);
    case "remove":
      return removeFromCart(cart, action.sku);
    case "clear":
      return EMPTY_CART;
  }
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.qty, 0);
}

/**
 * Lines joined with their Products for rendering; a stored SKU missing
 * from the Catalog (stale storage) is dropped — the Catalog, not the
 * storage, defines what exists.
 */
export function resolveCart(cart: Cart, products: Product[]): Array<CartLine & { product: Product }> {
  const resolved: Array<CartLine & { product: Product }> = [];
  for (const line of cart.lines) {
    const product = products.find((candidate) => candidate.sku === line.sku);
    if (product) resolved.push({ ...line, product });
  }
  return resolved;
}

/**
 * Lines joined with their Products for rendering (the Cart drawer and
 * the Order Request composition). `products === null` — the Catalog
 * data has not arrived yet (the per-category JSON loads lazily): every
 * line passes through with `product: null`, so the row shows its SKU,
 * the only fact known without the data. With the Catalog given, the
 * existing `resolveCart` semantics hold: stale SKUs are dropped — the
 * Catalog, not the storage, defines what exists (ADR 0027).
 */
export interface ResolvedCartLine extends CartLine {
  product: Product | null;
}

export function resolveCartLines(cart: Cart, products: Product[] | null): ResolvedCartLine[] {
  if (products === null) return cart.lines.map((line) => ({ ...line, product: null }));
  return resolveCart(cart, products);
}

export function loadCart(storage: Pick<Storage, "getItem">): Cart {
  const raw = storage.getItem(CART_STORAGE_KEY);
  if (raw === null) return EMPTY_CART;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_CART;
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Cart).lines)) {
    return EMPTY_CART;
  }
  const lines: CartLine[] = [];
  for (const entry of (parsed as Cart).lines) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as unknown as Record<string, unknown>;
    if (typeof record.sku !== "string" || record.sku.length === 0) continue;
    if (!Number.isInteger(record.qty) || (record.qty as number) <= 0) continue;
    lines.push({ sku: record.sku, qty: record.qty as number });
  }
  return { lines };
}

export function saveCart(storage: Pick<Storage, "setItem">, cart: Cart): void {
  storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}
