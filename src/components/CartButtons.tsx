import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EMPTY_CART, cartCount, resolveCartLines } from "../lib/cart";
import { getCartStore, type CartStore } from "../lib/cartStore";
import { loadOrderableProducts } from "../lib/catalogClient";
import type { Product } from "../lib/catalog";
import CartModal from "./CartModal";

/**
 * The header Cart button (Корзина, GLOSSARY.md) with its count badge
 * and the Cart drawer, mounted by the base layout on every page. The
 * island owns no Cart state (ADR 0027): it reads the singleton store —
 * the badge re-renders through useSyncExternalStore, and every
 * transition persists through the store's one write path, so the
 * badge, a reload and the Order Request form all read the same stored
 * Cart.
 *
 * The island is mounted client:load so the button prerenders into the
 * sticky header: a client:only mount leaves the header row without the
 * button until hydration and shifts the layout when it pops in. The
 * prerender has no localStorage (ADR 0027: the Cart store is
 * storage-backed and loud about it), so the server renders the empty
 * Cart through SERVER_SNAPSHOT_STORE; hydration starts from that same
 * snapshot (no mismatch) before the singleton store takes over — the
 * badge is absolutely positioned, so the count arriving moves nothing.
 *
 * The drawer-open policy listens once: a local add pulses the badge and
 * opens the drawer (the approved addToCart → openCart behavior); a
 * remote (cross-tab) change never does.
 *
 * Drawer rows need Product names: the Catalog loads lazily through
 * the shared `loadOrderableProducts()` loader (never inline in the
 * bundle). Until it arrives a line shows its SKU; the Cart holds only
 * Catalog SKUs, and the loader follows the populated Categories of
 * catalog.json — Насосы is the one orderable Category today (Spec #4).
 */
/**
 * The prerender's Cart view: the empty Cart, for both
 * useSyncExternalStore snapshots. Named explicitly rather than
 * expressed as a null-store fallback (CODING_STANDARDS: no silent
 * fallbacks for invariants TypeScript cannot see). Effects never run
 * on the server, so `dispatch` throwing loudly is the broken-invariant
 * alarm; `subscribe` keeps the hook's server contract.
 */
const SERVER_SNAPSHOT_STORE: CartStore = {
  getState: () => EMPTY_CART,
  dispatch: () => {
    throw new Error(
      "CartButtons: dispatch on the server snapshot store — the prerender never dispatches; the storage-backed store exists only in the browser (ADR 0027).",
    );
  },
  subscribe: () => () => {},
};

export default function CartButtons() {
  // One store per environment: the browser gets the storage-backed
  // singleton (ADR 0027), the prerender gets the empty-Cart snapshot
  // (SERVER_SNAPSHOT_STORE) — both branches named, no fallbacks.
  const store = import.meta.env.SSR ? SERVER_SNAPSHOT_STORE : getCartStore();
  const cart = useSyncExternalStore(
    store.subscribe,
    store.getState,
    // Hydration renders the server snapshot first, then re-checks
    // getSnapshot — the badge appears without a hydration mismatch.
    SERVER_SNAPSHOT_STORE.getState,
  );
  const [pulse, setPulse] = useState(0);
  const [open, setOpen] = useState(false);
  // null: the category JSON has not arrived yet — rows show their SKU.
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    return store.subscribe((change) => {
      if (change.source === "local" && change.action.type === "add") {
        setPulse((value) => value + 1);
        setOpen(true);
      }
    });
  }, [store]);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    loadOrderableProducts().then(
      (products) => setCatalog(products),
      // Keep the drawer usable without names; the next open retries.
      () => {
        requested.current = false;
      },
    );
  }, [open]);

  const lines = resolveCartLines(cart, catalog);
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
        onSetQty={(sku, qty) => store.dispatch({ type: "setQty", sku, qty })}
        onRemove={(sku) => store.dispatch({ type: "remove", sku })}
      />
    </>
  );
}
