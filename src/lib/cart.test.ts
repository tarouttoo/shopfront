import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  EMPTY_CART,
  type Cart,
  addToCart,
  cartCount,
  cartReducer,
  loadCart,
  removeFromCart,
  resolveCart,
  saveCart,
  setQty,
} from "./cart";
import { PRODUCTS } from "./catalog";

function storageWith(raw: string | null): Pick<Storage, "getItem"> & { store: Map<string, string> } {
  const store = new Map<string, string>();
  if (raw !== null) store.set(CART_STORAGE_KEY, raw);
  return { store, getItem: (key: string) => store.get(key) ?? null };
}

describe("cart reducer", () => {
  it("adds a new line with qty 1", () => {
    expect(addToCart(EMPTY_CART, "A-01")).toEqual({ lines: [{ sku: "A-01", qty: 1 }] });
  });

  it("merges repeated adds of the same SKU", () => {
    let cart = addToCart(EMPTY_CART, "A-01");
    cart = addToCart(cart, "A-01");
    cart = addToCart(cart, "Б-01");
    expect(cart).toEqual({
      lines: [
        { sku: "A-01", qty: 2 },
        { sku: "Б-01", qty: 1 },
      ],
    });
  });

  it("setQty to 0 removes the line, negative and fractional qtys are ignored", () => {
    const cart: Cart = { lines: [{ sku: "A-01", qty: 2 }] };
    expect(setQty(cart, "A-01", 0)).toEqual(EMPTY_CART);
    expect(setQty(cart, "A-01", 5)).toEqual({ lines: [{ sku: "A-01", qty: 5 }] });
    expect(setQty(cart, "A-01", -1)).toEqual(cart);
    expect(setQty(cart, "A-01", 1.5)).toEqual(cart);
  });

  it("remove drops only the named line", () => {
    const cart: Cart = {
      lines: [
        { sku: "A-01", qty: 1 },
        { sku: "Б-01", qty: 3 },
      ],
    };
    expect(removeFromCart(cart, "A-01")).toEqual({ lines: [{ sku: "Б-01", qty: 3 }] });
  });

  it("dispatches every action type", () => {
    let cart = cartReducer(EMPTY_CART, { type: "add", sku: "В-01" });
    cart = cartReducer(cart, { type: "setQty", sku: "В-01", qty: 4 });
    expect(cart).toEqual({ lines: [{ sku: "В-01", qty: 4 }] });
    expect(cartReducer(cart, { type: "clear" })).toEqual(EMPTY_CART);
  });

  it("counts total quantity", () => {
    const cart: Cart = {
      lines: [
        { sku: "A-01", qty: 2 },
        { sku: "Б-01", qty: 3 },
      ],
    };
    expect(cartCount(cart)).toBe(5);
    expect(cartCount(EMPTY_CART)).toBe(0);
  });
});

describe("resolveCart", () => {
  it("drops lines whose SKU is not in the Catalog", () => {
    const cart: Cart = {
      lines: [
        { sku: "1", qty: 2 },
        { sku: "УСТАРЕВШИЙ", qty: 1 },
      ],
    };
    const resolved = resolveCart(cart, PRODUCTS);
    expect(resolved.map((line) => line.sku)).toEqual(["1"]);
    expect(resolved[0]?.product.name).toBe("BM 1-2A A-D-E-HQQE");
  });
});

describe("loadCart / saveCart", () => {
  it("returns an empty cart when nothing is stored", () => {
    expect(loadCart(storageWith(null))).toEqual(EMPTY_CART);
  });

  it("round-trips a saved cart", () => {
    const storage = storageWith(null);
    const setter = { setItem: (key: string, value: string) => storage.store.set(key, value) };
    saveCart(setter, { lines: [{ sku: "A-01", qty: 2 }] });
    expect(loadCart(storage)).toEqual({ lines: [{ sku: "A-01", qty: 2 }] });
  });

  it("resets on invalid JSON, wrong shape, and malformed lines", () => {
    expect(loadCart(storageWith("not json"))).toEqual(EMPTY_CART);
    expect(loadCart(storageWith('{"nolines":true}'))).toEqual(EMPTY_CART);
    expect(loadCart(storageWith('"array"? nope'))).toEqual(EMPTY_CART);
    expect(
      loadCart(
        storageWith(
          '{"lines":[{"sku":"","qty":1},{"sku":"A-01","qty":0},{"sku":"A-01","qty":1.5},{"sku":"A-01","qty":2},{"nonsense":true}]}',
        ),
      ),
    ).toEqual({ lines: [{ sku: "A-01", qty: 2 }] });
  });
});
