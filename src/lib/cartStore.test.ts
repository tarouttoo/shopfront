import { describe, expect, it, vi } from "vitest";
import {
  CART_STORAGE_KEY,
  EMPTY_CART,
  type CartAction,
  cartReducer,
  loadCart,
} from "./cart";
import {
  getCartStore,
  type CartChange,
  type CartStoreAdapters,
  type CartStore,
} from "./cartStore";

type FakeStorage = Pick<Storage, "getItem" | "setItem"> & { store: Map<string, string> };

function fakeStorage(initial?: Record<string, string>): FakeStorage {
  const store = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
  };
}

/**
 * The cross-tab carrier: in the browser the `storage` event fires on
 * the other tabs' globalThis. Node ships EventTarget but no
 * StorageEvent, so `fire` dispatches a plain Event carrying the key —
 * exactly the one property the store reads.
 */
function fakeTabEvents() {
  const target = new EventTarget();
  let added = 0;
  const adapters: NonNullable<CartStoreAdapters["tabEvents"]> = {
    addEventListener: (...args) => {
      added += 1;
      target.addEventListener(...args);
    },
    removeEventListener: (...args) => target.removeEventListener(...args),
  };
  return {
    adapters,
    addedCount: () => added,
    fire: (key: string | null) => {
      target.dispatchEvent(Object.assign(new Event("storage"), { key }));
    },
  };
}

function cartWith(storage: FakeStorage, tab = fakeTabEvents()): CartStore {
  return getCartStore({ storage, tabEvents: tab.adapters });
}

describe("getCartStore singleton", () => {
  it("returns the same instance for the same storage", () => {
    const storage = fakeStorage();
    expect(getCartStore({ storage, tabEvents: fakeTabEvents().adapters })).toBe(
      getCartStore({ storage, tabEvents: fakeTabEvents().adapters }),
    );
  });

  it("isolates stores behind different storages", () => {
    const storageA = fakeStorage();
    const storageB = fakeStorage();
    const storeA = cartWith(storageA);
    const storeB = cartWith(storageB);
    const heardByB: CartChange[] = [];
    storeB.subscribe((change) => heardByB.push(change));

    storeA.dispatch({ type: "add", sku: "A-01" });

    expect(storeA.getState().lines).toHaveLength(1);
    expect(storeB.getState()).toEqual(EMPTY_CART);
    expect(heardByB).toEqual([]);
  });

  it("converges duplicated module evaluations on one instance (globalThis anchor)", async () => {
    const storage = fakeStorage();
    vi.resetModules();
    const first = await import("./cartStore");
    const storeA = first.getCartStore({ storage, tabEvents: fakeTabEvents().adapters });
    vi.resetModules();
    const second = await import("./cartStore");
    const storeB = second.getCartStore({ storage, tabEvents: fakeTabEvents().adapters });

    expect(storeB).toBe(storeA);

    // One instance means one listener registry: dispatched through the
    // re-evaluated module's binding, heard through the original.
    const changes: CartChange[] = [];
    storeA.subscribe((change) => changes.push(change));
    storeB.dispatch({ type: "add", sku: "A-01" });
    expect(changes).toEqual([{ source: "local", action: { type: "add", sku: "A-01" } }]);
    expect(storeA.getState()).toEqual({ lines: [{ sku: "A-01", qty: 1 }] });
  });

  it("import has no side effects; the storage listener attaches once, at creation", () => {
    const storage = fakeStorage();
    const tab = fakeTabEvents();
    vi.resetModules();
    const mod = import("./cartStore");

    return mod.then((module) => {
      expect(tab.addedCount()).toBe(0);
      module.getCartStore({ storage, tabEvents: tab.adapters });
      expect(tab.addedCount()).toBe(1);
      module.getCartStore({ storage, tabEvents: tab.adapters });
      expect(tab.addedCount()).toBe(1);
    });
  });

  it("throws loudly when the platform has no storage — no silent in-memory mode", () => {
    // Node (this suite's environment) has no globalThis.localStorage.
    expect(() => getCartStore()).toThrow();
  });
});

describe("dispatch: one write path", () => {
  it("persists, commits and notifies as one synchronous operation", () => {
    const storage = fakeStorage();
    const store = cartWith(storage);
    const changes: CartChange[] = [];
    store.subscribe((change) => changes.push(change));

    store.dispatch({ type: "add", sku: "A-01" });

    const committed = store.getState();
    expect(committed).toEqual({ lines: [{ sku: "A-01", qty: 1 }] });
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(JSON.stringify(committed));
    expect(changes).toEqual([{ source: "local", action: { type: "add", sku: "A-01" } }]);
    // Stable snapshot reference between changes (useSyncExternalStore).
    expect(store.getState()).toBe(committed);
  });

  it("sequences every transition through cartReducer, never deciding itself", () => {
    const storage = fakeStorage();
    const store = cartWith(storage);
    let pure = EMPTY_CART;
    const actions: CartAction[] = [
      { type: "add", sku: "A-01" },
      { type: "add", sku: "A-01" },
      { type: "add", sku: "Б-02" },
      { type: "setQty", sku: "A-01", qty: 5 },
      { type: "remove", sku: "Б-02" },
      { type: "add", sku: "В-03" },
      { type: "clear" },
    ];

    for (const action of actions) {
      pure = cartReducer(pure, action);
      store.dispatch(action);
      expect(store.getState()).toEqual(pure);
      expect(storage.store.get(CART_STORAGE_KEY)).toBe(JSON.stringify(pure));
    }
  });

  it("suppresses no-ops: a reference-equal reducer result writes and notifies nothing", () => {
    const storage = fakeStorage();
    const store = cartWith(storage);
    const changes: CartChange[] = [];
    store.subscribe((change) => changes.push(change));

    store.dispatch({ type: "setQty", sku: "A-01", qty: -1 }); // invalid qty → same reference
    store.dispatch({ type: "clear" }); // already EMPTY_CART → same reference

    expect(changes).toEqual([]);
    expect(store.getState()).toEqual(EMPTY_CART);
    expect(storage.store.get(CART_STORAGE_KEY)).toBeUndefined(); // nothing ever written

    store.dispatch({ type: "add", sku: "A-01" }); // a real change still notifies
    expect(changes).toEqual([{ source: "local", action: { type: "add", sku: "A-01" } }]);
  });

  it("aborts atomically when setItem throws, then self-heals on the next dispatch", () => {
    const storage = fakeStorage({
      [CART_STORAGE_KEY]: JSON.stringify({ lines: [{ sku: "A-01", qty: 2 }] }),
    });
    const store = cartWith(storage);
    const initial = store.getState();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    storage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(() => store.dispatch({ type: "add", sku: "Б-02" })).toThrow("quota exceeded");
    expect(store.getState()).toBe(initial);
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(JSON.stringify(initial));
    expect(notified).toBe(0);

    // Self-heal: the next successful dispatch persists the full state.
    storage.setItem = (key, value) => storage.store.set(key, value);
    store.dispatch({ type: "add", sku: "Б-02" });
    const healed = store.getState();
    expect(healed).toEqual({
      lines: [
        { sku: "A-01", qty: 2 },
        { sku: "Б-02", qty: 1 },
      ],
    });
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(JSON.stringify(healed));
    expect(notified).toBe(1);
  });
});

describe("cross-tab sync", () => {
  it("adopts a remote storage event: getState() equals loadCart(storage)", () => {
    const storage = fakeStorage();
    const tab = fakeTabEvents();
    const store = cartWith(storage, tab);

    // Another tab wrote the same storage; the browser fires `storage` here.
    storage.store.set(CART_STORAGE_KEY, JSON.stringify({ lines: [{ sku: "C-09", qty: 3 }] }));
    const changes: CartChange[] = [];
    store.subscribe((change) => changes.push(change));
    tab.fire(CART_STORAGE_KEY);

    expect(store.getState()).toEqual(loadCart(storage));
    expect(store.getState()).toEqual({ lines: [{ sku: "C-09", qty: 3 }] });
    expect(changes).toEqual([{ source: "remote" }]);
  });

  it("treats a value-identical remote write as a no-op", () => {
    const storage = fakeStorage();
    const tab = fakeTabEvents();
    const store = cartWith(storage, tab);
    store.dispatch({ type: "add", sku: "A-01" });
    const before = store.getState();
    const changes: CartChange[] = [];
    store.subscribe((change) => changes.push(change));

    // A remote tab wrote exactly what this tab already holds.
    tab.fire(CART_STORAGE_KEY);

    expect(changes).toEqual([]);
    expect(store.getState()).toBe(before);
  });

  it("ignores foreign-key storage events", () => {
    const storage = fakeStorage();
    const tab = fakeTabEvents();
    const store = cartWith(storage, tab);
    const before = store.getState();
    const changes: CartChange[] = [];
    store.subscribe((change) => changes.push(change));

    tab.fire("shopfront.some.other.key");

    expect(changes).toEqual([]);
    expect(store.getState()).toBe(before);
  });
});

describe("init and notification discipline", () => {
  it("never writes at init: a malformed stored Cart loads EMPTY and is rewritten only by the next dispatch", () => {
    const garbage = "not json";
    const storage = fakeStorage({ [CART_STORAGE_KEY]: garbage });
    const store = cartWith(storage);

    expect(store.getState()).toEqual(EMPTY_CART);
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(garbage);

    store.dispatch({ type: "add", sku: "A-01" });
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(
      JSON.stringify({ lines: [{ sku: "A-01", qty: 1 }] }),
    );
  });

  it("dispatches reentrantly from a listener: the inner dispatch completes fully first", () => {
    const storage = fakeStorage();
    const store = cartWith(storage);
    const order: string[] = [];
    const unsubscribe = store.subscribe((change) => {
      if (change.source === "local" && change.action.type === "add" && change.action.sku === "A-01") {
        order.push("outer:A-01");
        store.dispatch({ type: "add", sku: "Б-02" });
        order.push("outer:A-01 done");
        unsubscribe();
      } else {
        order.push("inner");
      }
    });

    store.dispatch({ type: "add", sku: "A-01" });

    expect(order).toEqual(["outer:A-01", "inner", "outer:A-01 done"]);
    expect(store.getState()).toEqual({
      lines: [
        { sku: "A-01", qty: 1 },
        { sku: "Б-02", qty: 1 },
      ],
    });
    expect(storage.store.get(CART_STORAGE_KEY)).toBe(JSON.stringify(store.getState()));
  });

  it("iterates a listener-set snapshot: a listener added mid-notification waits for the next change", () => {
    const store = cartWith(fakeStorage());
    const seen: string[] = [];
    let unsubscribeSecond: () => void = () => {};
    const unsubscribeFirst = store.subscribe(() => {
      seen.push("first");
      unsubscribeSecond = store.subscribe(() => seen.push("second"));
      unsubscribeFirst(); // subscribe the second listener only once
    });

    store.dispatch({ type: "add", sku: "A-01" });
    expect(seen).toEqual(["first"]);

    store.dispatch({ type: "add", sku: "Б-02" });
    expect(seen).toEqual(["first", "second"]);

    unsubscribeFirst();
    unsubscribeSecond();
    store.dispatch({ type: "add", sku: "В-03" });
    expect(seen).toEqual(["first", "second"]);
  });

  it("stops notifying after unsubscribe", () => {
    const store = cartWith(fakeStorage());
    const changes: CartChange[] = [];
    const unsubscribe = store.subscribe((change) => changes.push(change));
    unsubscribe();
    store.dispatch({ type: "add", sku: "A-01" });
    expect(changes).toEqual([]);
  });
});
