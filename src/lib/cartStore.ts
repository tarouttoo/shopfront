import {
  CART_STORAGE_KEY,
  type Cart,
  type CartAction,
  cartReducer,
  loadCart,
  saveCart,
} from "./cart";

/**
 * The Cart store (Корзина, GLOSSARY.md) — the one Cart owner per tab
 * (ADR 0027): a framework-neutral singleton behind `getCartStore`.
 * `dispatch` is the only write path (cartReducer → saveCart → commit →
 * notify, one synchronous operation); `subscribe` is the only
 * observation path. The pure `cart.ts` survives untouched: the reducer
 * decides, the store sequences.
 *
 * Persistence precedes commit: a throwing `setItem` aborts atomically
 * (state, storage and listeners untouched), and the next successful
 * dispatch persists the full state (`saveCart` always serializes the
 * whole Cart — self-heal). A reference-equal reducer result writes and
 * notifies nothing (no-op suppression). The store never writes at
 * init: a malformed stored Cart loads as `EMPTY_CART` (the pinned
 * `loadCart` behavior) and is rewritten only by the next dispatch.
 */

export type CartChange =
  | { source: "local"; action: CartAction }
  | { source: "remote" };

export interface CartStore {
  /** Current Cart; stable reference between changes (useSyncExternalStore snapshot contract). */
  getState(): Cart;
  /** The only write path: cartReducer → saveCart → commit → notify, one synchronous operation. */
  dispatch(action: CartAction): void;
  /** The only observation path; fires synchronously after commit. Returns the unsubscriber. */
  subscribe(listener: (change: CartChange) => void): () => void;
}

export interface CartStoreAdapters {
  /** Test substitution; default: platform localStorage. Same behavior, never weaker. */
  storage?: Pick<Storage, "getItem" | "setItem">;
  /** Carrier of cross-tab storage events; default: platform globalThis. */
  tabEvents?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}

type CartStorage = NonNullable<CartStoreAdapters["storage"]>;
type TabEventCarrier = NonNullable<CartStoreAdapters["tabEvents"]>;
type CartStoreListener = (change: CartChange) => void;

/**
 * globalThis anchor keyed by the resolved storage: repeated calls with
 * the same storage return the same instance, even if the module is
 * evaluated twice (duplicated bundle chunks) — `Symbol.for` resolves to
 * the same symbol from every module instance.
 */
const ANCHOR = Symbol.for("shopfront.cartStores");

function createCartStore(storage: CartStorage, tabEvents: TabEventCarrier): CartStore {
  // The store never writes at init (ADR 0027): a malformed stored Cart
  // loads as EMPTY_CART and is rewritten only by the next dispatch.
  let state: Cart = loadCart(storage);
  const listeners = new Set<CartStoreListener>();

  // Notifications iterate a snapshot of the listener set: a listener
  // may dispatch reentrantly — the inner dispatch completes fully
  // before the outer iteration continues — or (un)subscribe; a
  // listener added mid-notification waits for the next change.
  const notify = (change: CartChange): void => {
    for (const listener of Array.from(listeners)) listener(change);
  };

  // Cross-tab sync rides the browser `storage` event, attached exactly
  // once per singleton, at creation. Anything not carrying our key is
  // ignored; the Cart is re-read from storage (not from the event
  // payload), so getState() equals loadCart(storage) after adoption,
  // and a value-identical remote write is a no-op.
  tabEvents.addEventListener("storage", (event) => {
    if ((event as StorageEvent).key !== CART_STORAGE_KEY) return;
    const adopted = loadCart(storage);
    if (JSON.stringify(adopted) === JSON.stringify(state)) return;
    state = adopted;
    notify({ source: "remote" });
  });

  return {
    getState: () => state,
    dispatch(action: CartAction): void {
      const next = cartReducer(state, action);
      if (next === state) return; // no-op suppression: nothing to write or notify
      saveCart(storage, next); // persist precedes commit: a throw aborts here
      state = next; // commit
      notify({ source: "local", action });
    },
    subscribe(listener: CartStoreListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Singleton anchored on globalThis keyed by the resolved storage:
 * repeated calls with the same storage return the same instance, even
 * if the module is evaluated twice (duplicated bundle chunks). Import
 * has no side effects; wiring happens here, client-side. Missing
 * platform storage throws loudly — no silent in-memory-only mode. When
 * adapters differ only in `tabEvents`, the first-created store for a
 * storage wins (the key is the storage).
 */
export function getCartStore(adapters?: CartStoreAdapters): CartStore {
  const storage = adapters?.storage ?? (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
  if (!storage) {
    throw new Error(
      "getCartStore: the platform has no localStorage — the Cart store is storage-backed by contract; inject adapters.storage to substitute it in tests.",
    );
  }
  const tabEvents = adapters?.tabEvents ?? (globalThis as TabEventCarrier);
  const anchor = globalThis as unknown as Record<symbol, Map<CartStorage, CartStore> | undefined>;
  const stores = (anchor[ANCHOR] ??= new Map<CartStorage, CartStore>());
  const existing = stores.get(storage);
  if (existing) return existing;
  const store = createCartStore(storage, tabEvents);
  stores.set(storage, store);
  return store;
}
