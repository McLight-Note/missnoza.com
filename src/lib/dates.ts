import { siteConfig } from "@/config/site";

/** Offset (ms) of the shop's time zone from UTC at the given instant. */
function zoneOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Start of a calendar day ("YYYY-MM-DD") in the shop's time zone, as epoch ms. */
export function shopDayStart(day: string, timeZone: string = siteConfig.timeZone) {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const offset = zoneOffsetMs(new Date(guess), timeZone);
  const first = guess - offset;
  // Re-check in case the offset differs at the adjusted instant (DST edges).
  return guess - zoneOffsetMs(new Date(first), timeZone);
}

/** Today's date ("YYYY-MM-DD") in the shop's time zone. */
export function shopToday(now: number, timeZone: string = siteConfig.timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(now),
  );
}

export function addDays(day: string, days: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Resolve a from/to day pair (inclusive, shop time zone) into an epoch range
 * [start, end). Falls back to the last `defaultDays` days.
 */
export function resolveRange(from: unknown, to: unknown, now: number, defaultDays = 30) {
  const today = shopToday(now);
  let toDay = isDay(to) ? to : today;
  let fromDay = isDay(from) ? from : addDays(toDay, -(defaultDays - 1));
  if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  return {
    fromDay,
    toDay,
    start: shopDayStart(fromDay),
    end: shopDayStart(addDays(toDay, 1)),
  };
}
