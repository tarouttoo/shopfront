import { useEffect, useReducer, useRef, useState } from "react";
import {
  cartCount,
  cartReducer,
  EMPTY_CART,
  loadCart,
  resolveCart,
  saveCart,
} from "../lib/cart";
import { fetchCategoryProducts } from "../lib/catalogClient";
import type { Product } from "../lib/catalog";
import CartModal, { type ModalLine } from "./CartModal";

/**
 * The header Cart button (Корзина, GLOSSARY.md) with its count badge
 * and the Cart drawer, mounted by the base layout on every page.
 * Add-to-cart clicks from any `[data-add-sku]` button on the page are
 * delegated into the cart reducer and open the drawer (the approved
 * addToCart → openCart behavior); every reducer transition is
 * persisted, so the badge, a reload and the Order Request form all
 * read the same stored Cart.
 *
 * Drawer rows need Product names: the category JSON loads lazily on
 * first open (never inline in the bundle). Until it arrives a line
 * shows its SKU; the Cart holds only Catalog SKUs, and the nasosy
 * asset is the one orderable category today (Spec #4).
 */
export default function CartButtons() {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART, () => loadCart(localStorage));
  const [pulse, setPulse] = useState(0);
  const [open, setOpen] = useState(false);
  // null: the category JSON has not arrived yet — rows show their SKU.
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>("[data-add-sku]");
      const sku = button?.dataset.addSku;
      if (!sku) return;
      dispatch({ type: "add", sku });
      setPulse((value) => value + 1);
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Persistence rides the reducer transitions: an add anywhere on the
  // page lands in storage, where loadCart picks it up on the next page.
  useEffect(() => {
    saveCart(localStorage, cart);
  }, [cart]);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    fetchCategoryProducts("nasosy").then(
      (products) => setCatalog(products),
      // Keep the drawer usable without names; the next open retries.
      () => {
        requested.current = false;
      },
    );
  }, [open]);

  const lines: ModalLine[] =
    catalog === null
      ? cart.lines.map((line) => ({ ...line, product: null }))
      : resolveCart(cart, catalog);

  const count = cartCount(cart);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Корзина: ${count} — оформить заявку`}
        className="relative inline-flex items-center gap-2 rounded-btn bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-primary-dark hover:shadow-lift"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="h-[18px] w-[18px]"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        <span>Корзина</span>
        {count > 0 && (
          <span
            key={pulse}
            className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-white"
          >
            {count}
          </span>
        )}
      </button>
      <CartModal
        open={open}
        lines={lines}
        onClose={() => setOpen(false)}
        onSetQty={(sku, qty) => dispatch({ type: "setQty", sku, qty })}
        onRemove={(sku) => dispatch({ type: "remove", sku })}
      />
    </>
  );
}
