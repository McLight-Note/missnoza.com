import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { siteConfig } from "@/config/site";

/**
 * Validate a delivery-contact phone number and return it in E.164 format
 * (e.g. +998901234567), or null if it is not acceptable.
 * Regions are configured in src/config/site.ts → phone.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length < 5 || trimmed.length > 32) return null;
  const parsed = parsePhoneNumberFromString(trimmed, siteConfig.phone.defaultCountry as CountryCode);
  if (!parsed || !parsed.isValid()) return null;
  const allowed = siteConfig.phone.allowedCountries;
  if (allowed.length > 0 && (!parsed.country || !allowed.includes(parsed.country))) return null;
  return parsed.number;
}

export function formatPhone(e164: string) {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
