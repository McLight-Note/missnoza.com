import { clsx, type ClassValue } from "clsx";
import { siteConfig } from "@/config/site";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    // Uzbek oʻ / gʻ and the tutuq belgisi: drop the apostrophe, keep the letter.
    .replace(/[\u0300-\u036f\u02bb\u02bc'\u2019\u2018`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Format an amount stored in minor units (e.g. tiyin/cents) for display.
 *
 * Written by hand on purpose: browsers do not all ship Uzbek number
 * formatting, and the server and the browser must print exactly the same
 * text. The style comes from `currency` in src/config/site.ts.
 */
export function formatMoney(minor: number) {
  const { fractionDigits, thousandsSeparator, decimalSeparator, label, labelAfter } = siteConfig.currency;
  const sign = minor < 0 ? "-" : "";
  const fixed = (Math.abs(minor) / 10 ** fractionDigits).toFixed(fractionDigits);
  const [whole, fraction] = fixed.split(".");
  // A non-breaking space keeps "185 000" and the currency on one line.
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator.replace(" ", "\u00a0"));
  const amount = fraction ? `${grouped}${decimalSeparator}${fraction}` : grouped;
  return labelAfter ? `${sign}${amount}\u00a0${label}` : `${sign}${label}${amount}`;
}

/** Convert a value typed by an admin ("12.50") into minor units, or null. */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.replace(/[\s,]/g, "");
  if (cleaned === "" || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const minor = Math.round(Number(cleaned) * 10 ** siteConfig.currency.fractionDigits);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Convert minor units into the plain number an admin edits in a form. */
export function moneyToInput(minor: number | null | undefined) {
  if (minor === null || minor === undefined) return "";
  return (minor / 10 ** siteConfig.currency.fractionDigits).toFixed(siteConfig.currency.fractionDigits);
}

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

// Only numbers are taken from Intl (in the shop's time zone); the wording is
// ours, so the server and every browser print the same Uzbek date.
const dateParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: siteConfig.timeZone,
  hourCycle: "h23",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function partsOf(ms: number) {
  const parts = dateParts.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: MONTHS[Number(get("month")) - 1] ?? "", year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** e.g. "16-noy, 2026, 02:09" */
export function formatDateTime(ms: number) {
  const p = partsOf(ms);
  return `${p.day}-${p.month}, ${p.year}, ${p.hour}:${p.minute}`;
}
/** e.g. "16-noy, 2026" */
export function formatDate(ms: number) {
  const p = partsOf(ms);
  return `${p.day}-${p.month}, ${p.year}`;
}

/** Only allow redirects to paths on this site (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/account") {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (next.length > 200) return fallback;
  return next;
}

export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `••• ••• ${digits.slice(-2)}`;
}
