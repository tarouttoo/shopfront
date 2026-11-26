/**
 * The checkout contact rules, ported verbatim from the approved source
 * (`reference/project-B/cart-order.js`: `isValidEmail`, `isValidPhone`,
 * the phone input mask, and the submit-time checks of «Оформление
 * заказа»). Interaction logic lives in this pure module and is tested
 * here, not in the rendered island (CODING_STANDARDS). The network
 * submitter (Web3Forms) and the payment-method field are intentionally
 * not ported: intake is a stub and online payment is stripped
 * (ADR 0021).
 */

export type ClientType = "Физлицо" | "Юрлицо";

export interface CheckoutContact {
  clientType: ClientType;
  /** «ФИО *», for Юрлицо labelled «Контактное лицо *». */
  name: string;
  /** «Название организации *», required for Юрлицо only. */
  company: string;
  /** «Телефон *». */
  phone: string;
  /** «Email». */
  email: string;
  /** The «Согласен с политикой конфиденциальности» checkbox. */
  agreed: boolean;
}

/** Port of the source `isValidEmail`. */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/**
 * Port of the source `isValidPhone`: no characters beyond digits,
 * spaces and +-( ); at most one «+», only leading; then either 11
 * digits starting with 7/8 (RF format) or 10 digits starting with 9
 * (no country code).
 */
export function isValidPhone(value: string): boolean {
  const raw = value.trim();
  if (!raw) return false;
  if (/[^\d\s+\-()]/.test(raw)) return false;
  if ((raw.match(/\+/g) ?? []).length > 1) return false;
  if (raw.includes("+") && raw[0] !== "+") return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return true;
  if (digits.length === 10 && digits[0] === "9") return true;
  return false;
}

/**
 * The source phone input mask, applied on every keystroke: letters and
 * other stray characters never reach the field.
 */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d\s+\-()]/g, "");
}

/**
 * The source submit-time checks, in the source field order. The source
 * pushed the same «корректный …» message twice when exactly one contact
 * was filled with an invalid value (two redundant branches); the port
 * reports each violation once — same messages, no duplication.
 */
export function checkoutErrors(fields: CheckoutContact): string[] {
  const errors: string[] = [];
  if (!fields.name.trim()) {
    errors.push(fields.clientType === "Юрлицо" ? "контактное лицо" : "ФИО");
  }
  if (fields.clientType === "Юрлицо" && !fields.company.trim()) {
    errors.push("название организации");
  }
  const phone = fields.phone.trim();
  const email = fields.email.trim();
  if (!phone && !email) {
    errors.push("телефон или email");
  } else {
    if (phone && !isValidPhone(phone)) {
      errors.push("корректный телефон (+7… или 8…, 10–11 цифр)");
    }
    if (email && !isValidEmail(email)) {
      errors.push("корректный email");
    }
  }
  if (!fields.agreed) {
    errors.push("согласие с политикой");
  }
  return errors;
}
