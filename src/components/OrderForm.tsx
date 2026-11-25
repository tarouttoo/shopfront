import { useMemo, useReducer, useState } from "react";
import {
  cartReducer,
  EMPTY_CART,
  loadCart,
  resolveCart,
  saveCart,
} from "../lib/cart";
import type { Product } from "../lib/catalog";
import { withBase } from "../lib/urls";

/**
 * The Order Request form (Заявка, GLOSSARY.md): positions collected in
 * the Cart plus the visitor's contact details. The submitter is a stub
 * by design (ADR 0021) — validation and the success screen only; where
 * requests actually land is a wayfinder decision.
 */
export default function OrderForm({ products }: { products: Product[] }) {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART, () => loadCart(localStorage));
  const lines = useMemo(() => resolveCart(cart, products), [cart, products]);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [company, setCompany] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-emerald-800">Заявка отправлена</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Позиций в заявке: {lines.reduce((sum, line) => sum + line.qty, 0)}. Мы свяжемся с
          вами и выставим счёт. Онлайн-оплаты нет — оплата после согласования.
        </p>
        <a
          href={withBase("catalog/")}
          className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Вернуться в каталог
        </a>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-xl font-semibold">Корзина пуста</h2>
        <p className="mt-2 text-sm text-slate-600">
          Добавьте позиции из каталога — заявка соберётся автоматически.
        </p>
        <a
          href={withBase("catalog/")}
          className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Перейти в каталог
        </a>
      </div>
    );
  }

  const submit = () => {
    const found: string[] = [];
    if (name.trim().length === 0) found.push("Укажите имя.");
    const contactValue = contact.trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue);
    const looksLikePhone = /^\+?[\d\s()-]{10,}$/.test(contactValue);
    if (!looksLikeEmail && !looksLikePhone) {
      found.push("Укажите телефон или email для ответа.");
    }
    setErrors(found);
    if (found.length > 0) return;
    saveCart(localStorage, EMPTY_CART);
    dispatch({ type: "clear" });
    setSubmitted(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Позиции заявки</h2>
        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li
              key={line.sku}
              className="flex items-center justify-between gap-3 border-b border-dashed border-slate-100 pb-3"
            >
              <div>
                <span className="font-mono text-xs text-slate-500">{line.sku}</span>
                <p className="text-sm font-medium">{line.product.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Убрать одну единицу: ${line.product.name}`}
                  onClick={() => dispatch({ type: "setQty", sku: line.sku, qty: line.qty - 1 })}
                  className="h-7 w-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium">{line.qty}</span>
                <button
                  type="button"
                  aria-label={`Добавить одну единицу: ${line.product.name}`}
                  onClick={() => dispatch({ type: "setQty", sku: line.sku, qty: line.qty + 1 })}
                  className="h-7 w-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Убрать позицию: ${line.product.name}`}
                  onClick={() => dispatch({ type: "remove", sku: line.sku })}
                  className="ml-2 text-xs text-red-500 hover:text-red-400"
                >
                  удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => dispatch({ type: "clear" })}
          className="mt-4 text-xs text-slate-500 hover:text-slate-400"
        >
          Очистить корзину
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Реквизиты для счёта</h2>
        {errors.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Имя *</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Телефон или email *</span>
            <input
              type="text"
              value={contact}
              onChange={(event) => setContact(event.currentTarget.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Организация</span>
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.currentTarget.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Комментарий</span>
            <textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Нажимая «Отправить заявку», вы соглашаетесь на обработку указанных контактов для
          выставления счёта.
        </p>
        <button
          type="button"
          onClick={submit}
          className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Отправить заявку
        </button>
      </section>
    </div>
  );
}
