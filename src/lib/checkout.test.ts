import { describe, expect, it } from "vitest";
import {
  checkoutErrors,
  isValidEmail,
  isValidPhone,
  sanitizePhoneInput,
} from "./checkout";

/**
 * The contact validators are a verbatim port of the approved source
 * (`reference/project-B/cart-order.js`, `isValidEmail` / `isValidPhone` /
 * the phone input mask). The rules below pin the port so the Order
 * Request form rejects exactly what the approved checkout rejected —
 * same inputs, same verdicts.
 */
describe("isValidPhone (ported from the approved source)", () => {
  it("accepts 11-digit Russian numbers starting with 7 or 8", () => {
    expect(isValidPhone("+7 900 123-45-67")).toBe(true);
    expect(isValidPhone("+79001234567")).toBe(true);
    expect(isValidPhone("89001234567")).toBe(true);
    expect(isValidPhone("8 900 123 45 67")).toBe(true);
    // The Client's own published number must pass the form's own gate.
    expect(isValidPhone("+7 (3952) 61-10-11")).toBe(true);
  });

  it("accepts 10 digits starting with 9 (no country code)", () => {
    expect(isValidPhone("9001234567")).toBe(true);
    expect(isValidPhone("900-123-45-67")).toBe(true);
  });

  it("rejects the empty and the too-short", () => {
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("   ")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("+7 (3952)")).toBe(false);
  });

  it("rejects wrong digit counts and wrong leading digits", () => {
    expect(isValidPhone("1234567890")).toBe(false); // 10 digits, not starting with 9
    expect(isValidPhone("90012345678")).toBe(false); // 11 digits, not starting with 7/8
    expect(isValidPhone("12345678901")).toBe(false); // 11 digits, starts with 1
    expect(isValidPhone("+790012345678")).toBe(false); // 12 digits
  });

  it("rejects letters and other stray characters", () => {
    expect(isValidPhone("8 900 abc-12-34")).toBe(false);
    expect(isValidPhone("телефон")).toBe(false);
    expect(isValidPhone("+7 900 123-45-67 доб. 5")).toBe(false); // «доб.» has letters
  });

  it("allows one plus, only at the start", () => {
    expect(isValidPhone("900-123-45+67")).toBe(false);
    expect(isValidPhone("++7 900 123-45-67")).toBe(false);
  });
});

describe("isValidEmail (ported from the approved source)", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("mail@example.com")).toBe(true);
    expect(isValidEmail("ae38@list.ru")).toBe(true);
    expect(isValidEmail("  padded@example.com  ")).toBe(true); // trimmed first
  });

  it("rejects the empty and the malformed", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
    expect(isValidEmail("mail@")).toBe(false);
    expect(isValidEmail("mail@example")).toBe(false); // no dot in the domain
    expect(isValidEmail("mail@example.t")).toBe(false); // TLD shorter than 2
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("ma il@example.com")).toBe(false); // whitespace inside
    expect(isValidEmail("mail@exa mple.com")).toBe(false);
  });
});

describe("sanitizePhoneInput (the source phone input mask)", () => {
  it("strips everything but digits, spaces, +, -, parentheses", () => {
    expect(sanitizePhoneInput("+7 (900) 123-45-67")).toBe("+7 (900) 123-45-67");
    expect(sanitizePhoneInput("abc+7 900 хх-45-67")).toBe("+7 900 -45-67");
    expect(sanitizePhoneInput("89001234567")).toBe("89001234567");
  });
});

describe("checkoutErrors (the source submit-time checks)", () => {
  const valid = {
    clientType: "Физлицо",
    name: "Иван Иванов",
    company: "",
    phone: "+7 900 123-45-67",
    email: "",
    agreed: true,
  } as const;

  it("passes a complete Физлицо request", () => {
    expect(checkoutErrors(valid)).toEqual([]);
  });

  it("passes a complete Юрлицо request", () => {
    expect(
      checkoutErrors({
        ...valid,
        clientType: "Юрлицо",
        company: "ООО «Компания»",
        phone: "",
        email: "mail@example.com",
      }),
    ).toEqual([]);
  });

  it("reports the missing contact-name field with the source wording", () => {
    const errors = checkoutErrors({ ...valid, name: "" });
    expect(errors).toContain("ФИО");
    const legal = checkoutErrors({ ...valid, clientType: "Юрлицо", company: "ООО «Компания»", name: "" });
    expect(legal).toContain("контактное лицо");
  });

  it("requires the organization name for Юрлицо", () => {
    const errors = checkoutErrors({ ...valid, clientType: "Юрлицо", company: " " });
    expect(errors).toContain("название организации");
    expect(checkoutErrors({ ...valid, company: "ООО «Компания»" })).toEqual([]); // Физлицо ignores it
  });

  it("demands phone or email when both are absent", () => {
    const errors = checkoutErrors({ ...valid, phone: "", email: "" });
    expect(errors).toContain("телефон или email");
  });

  it("reports a bad phone with the source message", () => {
    const errors = checkoutErrors({ ...valid, phone: "12345" });
    expect(errors).toContain("корректный телефон (+7… или 8…, 10–11 цифр)");
    expect(errors).toHaveLength(1);
  });

  it("reports a bad email with the source message", () => {
    const errors = checkoutErrors({ ...valid, phone: "", email: "mail@" });
    expect(errors).toContain("корректный email");
    expect(errors).toHaveLength(1);
  });

  it("reports both bad contacts together", () => {
    const errors = checkoutErrors({ ...valid, phone: "123", email: "mail@" });
    expect(errors).toContain("корректный телефон (+7… или 8…, 10–11 цифр)");
    expect(errors).toContain("корректный email");
  });

  it("demands the privacy consent", () => {
    const errors = checkoutErrors({ ...valid, agreed: false });
    expect(errors).toContain("согласие с политикой");
  });

  it("keeps the source field order in the combined message", () => {
    const errors = checkoutErrors({
      clientType: "Юрлицо",
      name: "",
      company: "",
      phone: "",
      email: "",
      agreed: false,
    });
    expect(errors).toEqual([
      "контактное лицо",
      "название организации",
      "телефон или email",
      "согласие с политикой",
    ]);
  });
});
