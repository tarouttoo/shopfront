# The Cart has one owner per tab: `getCartStore`

Two islands (`CartButtons`, `OrderForm`) each ran their own `useReducer`
over the same `localStorage` key, so on `/order` the header badge and
drawer showed a stale Cart after the Order Request submit cleared it —
the only sync between owners was the timing of writes. Decided
(design-it-twice with the operator, 2026-11-26: three radically
different interfaces compared): a **framework-neutral singleton Cart
store** in `src/lib/cartStore.ts` behind `getCartStore(adapters?)` —
`getState` / `dispatch` / `subscribe`, nothing else on the seam. The
pure core in `cart.ts` survives untouched: the reducer remains the only
decision point, the store only sequences persist → commit → notify as
one synchronous operation. The store instance is anchored on
`globalThis` (keyed by the injected storage), so duplicated bundle
chunks still converge on one store with one listener registry.

## Considered Options

- **React-replica hook** (`useCart()` owning state in every island,
  replicas converging via document events + storage): rejected — every
  hook instance subscribes, so each Cart transition re-renders the
  5818-position `ProductTable`; and the replica protocol
  (adoption / no-echo / rebase-before-mutate) replaces one owner with a
  convergence contract.
- **Event seam** (storage is the only truth, islands re-read on
  notifications, ports threaded through every signature): rejected as
  the whole design — the widest caller-facing contract (seven-rule
  delivery contract, advisory payloads) for two reader islands. Two of
  its elements were adopted: **no-op suppression** (a reference-equal
  reducer result writes and notifies nothing) and the **publish-only
  pin** (`ProductTable` must not subscribe, pinned by a test).

## Consequences

- The `data-add-sku` DOM seam is deleted: «В корзину» is a typed store
  call from `ProductTable`; drawer-open-on-add rides the `CartChange`
  origin tag (`local` add opens, `remote` does not).
- `ModalLine` dissolves into `resolveCartLines(cart, products | null)`
  in `cart.ts` — `products: null` passes every line through with
  `product: null` (SKU placeholders until the Catalog arrives).
- Cross-tab sync rides the browser `storage` event; concurrent tabs are
  last-write-wins per whole Cart — accepted for a single-visitor B2B
  shopfront.
- The badge can briefly count a stale SKU the drawer has already
  dropped — pre-existing behavior, deliberately preserved; changing it
  is a separate content decision.
- React binding stays per-island (`useSyncExternalStore` one-liner):
  small honest duplication instead of a shared hook (CODING_STANDARDS).
- The Client-facing behavior of the Cart is unchanged; this ADR moves
  only the seam (ADR `0021`'s island decision stands).
