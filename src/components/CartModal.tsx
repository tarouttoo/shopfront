import type { ResolvedCartLine } from "../lib/cart";
import { withBase } from "../lib/urls";

/**
 * The Cart drawer (Корзина, GLOSSARY.md), ported from the approved
 * `reference/project-B/cart-order.js` visuals: a right-side drawer over
 * a dimmed overlay, header «Корзина», position rows, footer with the
 * totals row and the full-width submit button. Adaptations per Spec #4:
 * «Оформить заявку» navigates to /order (the Web3Forms panel and the
 * payment-method select are stripped), prices never render («Цена по
 * запросу» is the only price wording), so the totals row shows the
 * position count, and each position gains quantity controls (the − / +
 * dispatch into the cart reducer).
 *
 * A line not yet resolved against the Catalog (the JSON loads lazily on
 * first open) displays its SKU — the only fact known without the data
 * (`resolveCartLines(cart, null)` passes it through with
 * `product: null`).
 */
interface Props {
  open: boolean;
  lines: ResolvedCartLine[];
  onClose: () => void;
  onSetQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
}

export default function CartModal({ open, lines, onClose, onSetQty, onRemove }: Props) {
  const count = lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[150] bg-black/35 transition-all duration-300 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Корзина"
        data-open={open}
        className={`fixed top-0 right-0 z-[200] flex h-screen w-[400px] max-w-full flex-col bg-white shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-300 max-md:w-full ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-haze px-5 py-[18px]">
          <h2 className="text-[1.2rem] font-bold">Корзина</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть корзину"
            className="cursor-pointer border-none bg-none text-[22px] leading-none text-ink-light hover:text-ink"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="text-ink-light">Корзина пуста</p>
          ) : (
            lines.map((line) => (
              <div
                key={line.sku}
                className="flex items-start justify-between gap-3 border-b border-haze py-3 last:border-b-0"
              >
                <div>
                  <h4 className="mb-1 text-[0.95rem] leading-snug font-bold">
                    {line.product?.name ?? line.sku}
                  </h4>
                  <p className="text-[0.85rem] text-ink-light">
                    {line.sku} · Цена по запросу · {line.qty} шт.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Убрать одну единицу: ${line.product?.name ?? line.sku}`}
                      onClick={() => onSetQty(line.sku, line.qty - 1)}
                      className="h-7 w-7 rounded border border-[#d0d5dd] text-ink-light hover:bg-mist"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{line.qty}</span>
                    <button
                      type="button"
                      aria-label={`Добавить одну единицу: ${line.product?.name ?? line.sku}`}
                      onClick={() => onSetQty(line.sku, line.qty + 1)}
                      className="h-7 w-7 rounded border border-[#d0d5dd] text-ink-light hover:bg-mist"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(line.sku)}
                  className="shrink-0 cursor-pointer rounded-btn border border-primary bg-transparent px-3 py-2 text-[13px] font-semibold text-primary hover:bg-primary/5"
                >
                  Удалить
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="border-t border-haze px-[18px] py-4">
          <div className="mb-3 flex justify-between font-bold">
            <span>Позиций</span>
            <span>{count}</span>
          </div>
          <a
            href={withBase("order/")}
            aria-disabled={lines.length === 0 ? "true" : undefined}
            className={`flex w-full items-center justify-center gap-1.5 rounded-btn px-3.5 py-2.5 text-sm font-semibold text-white transition ${
              lines.length === 0
                ? "pointer-events-none bg-primary/50"
                : "bg-primary hover:bg-primary-dark"
            }`}
          >
            Оформить заявку
          </a>
        </footer>
      </aside>
    </>
  );
}
