import { useEffect, useReducer, useState } from "react";
import {
  cartCount,
  cartReducer,
  EMPTY_CART,
  loadCart,
  saveCart,
} from "../lib/cart";
import { withBase } from "../lib/urls";

/**
 * The header Cart button (Корзина, GLOSSARY.md) with its count badge,
 * mounted by the base layout on every page. Add-to-cart clicks from the
 * static `[data-add-sku]` buttons are delegated into the cart reducer,
 * and every reducer transition is persisted — so the badge, a reload
 * and the Order Request form all read the same stored Cart.
 */
export default function CartButtons() {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART, () => loadCart(localStorage));
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>("[data-add-sku]");
      const sku = button?.dataset.addSku;
      if (!sku) return;
      dispatch({ type: "add", sku });
      setPulse((value) => value + 1);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Persistence rides the reducer transitions: an add anywhere on the
  // page lands in storage, where loadCart picks it up on the next page.
  useEffect(() => {
    saveCart(localStorage, cart);
  }, [cart]);

  const count = cartCount(cart);

  return (
    <a
      href={withBase("order/")}
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
    </a>
  );
}
