/**
 * Store-wide configuration.
 *
 * Everything here is a PLACEHOLDER that is safe to edit. Brand name, currency,
 * phone region and default contact details live in this one file so the shop
 * is easy to customise. Delivery areas, fees, contact details and the
 * announcement bar can also be changed later from Admin → Sozlamalar without
 * touching code (values saved there override the defaults below).
 */

export const siteConfig = {
  /** Brand name shown in the header, footer, emails and page titles. */
  name: "Miss Noza",
  tagline: "Kosmetika va teri parvarishi vositalari",
  description:
    "Miss Noza doʻkonidan kosmetika va teri parvarishi vositalari. Katalogni koʻring, onlayn buyurtma bering va yetkazib berilganda toʻlang.",

  /** Public URL of the site. Set NEXT_PUBLIC_SITE_URL in production. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),

  /** Logo shown in the header. Replace the file in /public/brand to rebrand. */
  logo: { src: "/brand/logo.svg", width: 148, height: 32 },
  heroImage: "/brand/hero.svg",

  /**
   * Currency. Prices are stored as whole numbers in the currency's smallest
   * unit. `fractionDigits` says how many decimals that unit has: 0 for UZS,
   * 2 for USD / EUR. Change this BEFORE entering real prices.
   */
  currency: {
    code: "UZS",
    /** Shown next to amounts, e.g. "185 000 soʻm". */
    label: "soʻm",
    /** true → "185 000 soʻm"; false → "$185.00" style (label first). */
    labelAfter: true,
    thousandsSeparator: " ",
    decimalSeparator: ",",
    fractionDigits: 0,
  },

  /** Time zone used for order dates and the admin dashboard date filters. */
  timeZone: "Asia/Tashkent",

  /**
   * Delivery-contact phone numbers (no SMS is ever sent).
   * `defaultCountry` lets customers type a local number without the +code.
   * `allowedCountries` restricts which countries' numbers are accepted;
   * leave it empty ([]) to accept any valid international number.
   */
  phone: {
    defaultCountry: "UZ",
    allowedCountries: ["UZ"] as string[],
    example: "+998 90 123 45 67",
  },

  /** Order limits (also enforced on the server). */
  order: {
    referencePrefix: "MN",
    maxQuantityPerItem: 10,
    maxLines: 30,
  },

  /** Defaults used until you save your own values in Admin → Sozlamalar (/admin/settings). */
  defaults: {
    lowStockThreshold: 5,
    freeDeliveryThreshold: null as number | null,
    deliveryAreas: [
      { id: "city", name: "Toshkent shahri", fee: 25000 },
      { id: "region", name: "Toshkent viloyati", fee: 40000 },
      { id: "other", name: "Boshqa viloyatlar (kuryer / pochta)", fee: 60000 },
    ],
    contact: {
      phone: "+998 00 000 00 00",
      email: "hello@example.com",
      address: "Doʻkon manzili shu yerda yoziladi",
      hours: "Dushanba–Shanba, 10:00–19:00",
      instagram: "",
      telegram: "",
    },
    announcement: "Toʻlov yetkazib berilganda · Bir necha daqiqada buyurtma bering",
  },
} as const;

export type SiteConfig = typeof siteConfig;
