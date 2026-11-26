import { useEffect, useMemo, useReducer, useState } from "react";
import { SITE } from "../data/site";
import {
  type ClientType,
  checkoutErrors,
  sanitizePhoneInput,
} from "../lib/checkout";
import {
  cartReducer,
  EMPTY_CART,
  loadCart,
  resolveCart,
  saveCart,
} from "../lib/cart";
import type { Product } from "../lib/catalog";
import { fetchCategoryProducts } from "../lib/catalogClient";
import { withBase } from "../lib/urls";
import type { ModalLine } from "./CartModal";

/**
 * The checkout of the Order Request page (Заявка, GLOSSARY.md): the
 * Cart's состав plus the contact fields of the approved source
 * checkout (`reference/project-B/cart-order.js`, the panel the source
 * titles «Оформление …»): buyer type, contact name, legal-entity
 * details, phone, email, comment, consent. The source's payment-method
 * select and its hints are deliberately not ported (ADR 0021: no
 * online payment), and the submitter stays a stub: validation →
 * success screen, no network. Rejection strings come from the pure
 * `checkout` module; the visuals follow the approved checkout styles
 * (field labels, inputs, the segmented buyer-type control, the consent
 * line) as Tailwind tokens. UI wording stays glossary-only (Заявка —
 * this file must stay greppably free of the banned retail stem).
 *
 * Line names resolve against the Catalog loaded the Cart drawer's way:
 * fetched lazily from the build-time per-category asset, never passed
 * as island props — props would serialize all 5818 positions into the
 * prerendered HTML. Until it arrives a row shows its SKU, the only
 * fact known without the data; a failed fetch keeps that degraded
 * state, and a page refresh retries losslessly (the Cart persists in
 * storage).
 */

const FIELD_INPUT =
  "w-full rounded-lg border border-[#d0d5dd] px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none";
const FIELD_LABEL = "mb-1 block text-xs font-semibold text-ink-light";

export default function OrderForm() {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART, () => loadCart(localStorage));
  // null: the category JSON has not arrived yet — rows show their SKU.
  const [catalog, setCatalog] = useState<Product[] | null>(null);

  const hasLines = cart.lines.length > 0;

  useEffect(() => {
    if (!hasLines) return;
    let cancelled = false;
    fetchCategoryProducts("nasosy").then(
      (products) => {
        if (!cancelled) setCatalog(products);
      },
      // Keep the composition usable with SKU-only rows; a page
      // refresh retries losslessly, so the failure needs no UI here.
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [hasLines]);

  const lines: ModalLine[] = useMemo(
    () =>
      catalog === null
        ? cart.lines.map((line) => ({ ...line, product: null }))
        : resolveCart(cart, catalog),
    [cart, catalog],
  );

  const [clientType, setClientType] = useState<ClientType>("Физлицо");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [inn, setInn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const legal = clientType === "Юрлицо";

  if (submitted) {
    // Success screen per the source: the green confirmation, the
    // button in its «принята» state, plus the way back to the Catalog.
    return (
      <div className="rounded-card border border-haze bg-white p-8 text-center shadow-card">
        <p className="text-[.95rem] font-semibold leading-relaxed text-[#2e7d32]">
          Заявка отправлена менеджеру. Мы свяжемся с вами для подтверждения.
        </p>
        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-default rounded-btn bg-primary px-3.5 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          Заявка принята
        </button>
        {/* The aggregate /catalog page is removed (ADR 0024); the
            catalog surface is the category pages — nasosy carries the
            product table. */}
        <a
          href={withBase("nasosy/")}
          className="mt-3 inline-block rounded-btn border border-primary px-3.5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
        >
          Вернуться в каталог
        </a>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-card border border-haze bg-white p-8 text-center shadow-card">
        <h2 className="text-xl font-semibold text-ink">Корзина пуста</h2>
        <p className="mt-2 text-sm text-ink-light">
          Добавьте позиции из каталога — заявка соберётся автоматически.
        </p>
        <a
          href={withBase("nasosy/")}
          className="mt-4 inline-block rounded-btn bg-primary px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Перейти в каталог
        </a>
      </div>
    );
  }

  const submit = () => {
    const found = checkoutErrors({ clientType, name, company, phone, email, agreed });
    setErrors(found);
    if (found.length > 0) return;
    saveCart(localStorage, EMPTY_CART);
    dispatch({ type: "clear" });
    setSubmitted(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-card border border-haze bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Состав заявки</h2>
        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li
              key={line.sku}
              className="flex items-center justify-between gap-3 border-b border-haze pb-3"
            >
              <div>
                <span className="font-mono text-xs text-ink-light">{line.sku}</span>
                <p className="text-sm font-medium text-ink">{line.product?.name ?? line.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Убрать одну единицу: ${line.product?.name ?? line.sku}`}
                  onClick={() => dispatch({ type: "setQty", sku: line.sku, qty: line.qty - 1 })}
                  className="h-7 w-7 rounded border border-[#d0d5dd] text-ink-light hover:bg-mist"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium text-ink">{line.qty}</span>
                <button
                  type="button"
                  aria-label={`Добавить одну единицу: ${line.product?.name ?? line.sku}`}
                  onClick={() => dispatch({ type: "setQty", sku: line.sku, qty: line.qty + 1 })}
                  className="h-7 w-7 rounded border border-[#d0d5dd] text-ink-light hover:bg-mist"
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Убрать позицию: ${line.product?.name ?? line.sku}`}
                  onClick={() => dispatch({ type: "remove", sku: line.sku })}
                  className="ml-2 rounded-btn border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between font-bold text-ink">
          <span>Итого</span>
          <span>По запросу</span>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "clear" })}
          className="mt-4 text-xs text-ink-light hover:text-primary"
        >
          Очистить корзину
        </button>
      </section>

      <section className="rounded-card border border-haze bg-white p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Реквизиты для счёта</h2>

        {errors.length > 0 && (
          <p className="mt-3 text-[.88rem] font-semibold text-[#c62828]">
            Проверьте: {errors.join("; ")}
          </p>
        )}

        <div className="mt-4">
          <div className={FIELD_LABEL}>Тип покупателя</div>
          <div className="grid grid-cols-2 gap-2">
            {(["Физлицо", "Юрлицо"] as const).map((type) => (
              <label
                key={type}
                className={`flex cursor-pointer items-center gap-2 rounded-btn border px-3 py-2.5 text-sm font-semibold ${
                  clientType === type
                    ? "border-primary bg-[#f3f7ff] text-primary"
                    : "border-[#d0d5dd] text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="client-type"
                  value={type}
                  checked={clientType === type}
                  onChange={() => setClientType(type)}
                  className="accent-primary"
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="block">
            <span className={FIELD_LABEL}>{legal ? "Контактное лицо *" : "ФИО *"}</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder={legal ? "ФИО менеджера" : "Иванов Иван Иванович"}
              className={FIELD_INPUT}
            />
          </label>
        </div>

        {legal && (
          <>
            <div className="mt-3">
              <label className="block">
                <span className={FIELD_LABEL}>Название организации *</span>
                <input
                  type="text"
                  value={company}
                  onChange={(event) => setCompany(event.currentTarget.value)}
                  placeholder={"ООО «Компания»"}
                  className={FIELD_INPUT}
                />
              </label>
            </div>
            <div className="mt-3">
              <label className="block">
                <span className={FIELD_LABEL}>ИНН</span>
                <input
                  type="text"
                  value={inn}
                  onChange={(event) => setInn(event.currentTarget.value)}
                  placeholder="1234567890"
                  inputMode="numeric"
                  className={FIELD_INPUT}
                />
              </label>
            </div>
          </>
        )}

        <div className="mt-3">
          <label className="block">
            <span className={FIELD_LABEL}>Телефон *</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(sanitizePhoneInput(event.currentTarget.value))}
              placeholder="+7 900 123-45-67"
              inputMode="tel"
              autoComplete="tel"
              className={FIELD_INPUT}
            />
          </label>
        </div>

        <div className="mt-3">
          <label className="block">
            <span className={FIELD_LABEL}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="mail@example.com"
              autoComplete="email"
              className={FIELD_INPUT}
            />
          </label>
        </div>

        <div className="mt-3">
          <label className="block">
            <span className={FIELD_LABEL}>Комментарий</span>
            <textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder="Пожелания к заявке"
              className={`${FIELD_INPUT} min-h-16 resize-y`}
            />
          </label>
        </div>

        <label className="mt-4 flex items-start gap-2.5 text-[.82rem] leading-[1.45] text-ink-light">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.currentTarget.checked)}
            className="mt-0.5 h-[18px] w-[18px] flex-none accent-primary"
          />
          <span>
            Согласен с{" "}
            <a href={withBase(SITE.privacyPath)} className="text-primary underline">
              политикой конфиденциальности
            </a>
          </span>
        </label>

        <button
          type="button"
          onClick={submit}
          className="mt-4 w-full rounded-btn bg-primary px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          Подтвердить заявку
        </button>
      </section>
    </div>
  );
}
