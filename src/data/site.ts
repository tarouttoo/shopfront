/**
 * The Client's identity (Spec #4, decision 1; ADR 0022): the single
 * source of truth every component reads — names, contacts, legal facts,
 * the map widget. Nothing about identity may be hardcoded in
 * components. Values are the approved ones from the source snapshot
 * (`reference/project-B/index.html` header/footer/contacts).
 */

export interface Phone {
  /** Human-readable display form, e.g. «+7 (3952) 61-10-11». */
  display: string;
  /** Digits only, for the `tel:` href. */
  tel: string;
}

export const SITE = {
  /** Full legal name. */
  name: "ООО ИТЦ «Альтер Энерго»",
  /** Short brand / logo text. */
  brand: "Альтер Энерго",
  /** Logo monogram, as in the approved favicon. */
  monogram: "AE",
  /** Logo sub-line under the brand. */
  tagline: "ИТЦ · Иркутск",
  /** Footer description of the company. */
  about:
    "Инженерно-технический центр. Проектирование, монтаж и автоматизация систем отопления, водоснабжения и энергоэффективности в Иркутске.",
  /** Default meta description (approved source). */
  description:
    "Проектирование и внедрение АСУ ТП на базе ОВЕН. Производство НКУ. Поставка оборудования для теплоэнергетики, монтаж, пусконаладка и сервис в Иркутске.",
  /** Full legal address. */
  address: "г. Иркутск, ул. Клары Цеткин, 9а лит. В, офис 441",
  /** Short address for the top bar, as in the approved header. */
  addressShort: "г. Иркутск, ул. Клары Цеткин, 9а",
  phones: [
    { display: "+7 (3952) 61-10-11", tel: "+73952611011" },
    { display: "+7 (3952) 72-57-15", tel: "+73952725715" },
  ],
  email: "ae38@list.ru",
  /** The Client's production domain, as named in the privacy policy. */
  domain: "ae38.ru",
  workingHours: "Пн–Пт: 10:00–18:00",
  /** Yandex map widget: pin at 104.256634, 52.277113, as in the source. */
  mapEmbedUrl:
    "https://yandex.ru/map-widget/v1/?ll=104.256634%2C52.277113&z=16&pt=104.256634,52.277113,pm2rdm",
  inn: "ИНН 3812097834",
  ogrn: "ОГРН 1073812005706",
  /** Copyright line, as in the approved footer. */
  copyright: "© 2007–2026 ООО ИТЦ «Альтер Энерго». Все права защищены.",
  /** Privacy policy route; the page itself ships in a later ticket. */
  privacyPath: "privacy/",
} as const;
