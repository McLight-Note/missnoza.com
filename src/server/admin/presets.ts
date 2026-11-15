import "server-only";
import { addDays, resolveRange, shopToday } from "@/lib/dates";

/**
 * The date range selected in an admin filter (defaults to the last 30 days)
 * plus the quick-pick presets, all in the shop's time zone.
 */
export function adminRange(from: unknown, to: unknown) {
  const now = Date.now();
  const today = shopToday(now);
  return {
    range: resolveRange(from, to, now, 30),
    presets: [
      { label: "Bugun", from: today, to: today },
      { label: "Oxirgi 7 kun", from: addDays(today, -6), to: today },
      { label: "Oxirgi 30 kun", from: addDays(today, -29), to: today },
      { label: "Shu oy", from: `${today.slice(0, 8)}01`, to: today },
      { label: "Oxirgi 90 kun", from: addDays(today, -89), to: today },
    ],
  };
}
