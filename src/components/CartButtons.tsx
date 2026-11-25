import { useEffect, useReducer, useState } from "react";
import {
  cartCount,
  cartReducer,
  EMPTY_CART,
  loadCart,
} from "../lib/cart";
import { withBase } from "../lib/urls";

/**
 * Cart wiring for the catalog page: the add buttons are static HTML
 * (`[data-add-sku]`); this island delegates their clicks into the cart
 * reducer and shows the floating Cart pill.
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

  const count = cartCount(cart);

  return (
    <div
      key={pulse}
      className={`fixed right-5 bottom-5 z-50 transition ${count > 0 ? "" : "invisible"}`}
    >
      <a
        href={withBase("order/")}
        className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-500"
      >
        В корзине: {count} — оформить заявку
      </a>
    </div>
  );
}
