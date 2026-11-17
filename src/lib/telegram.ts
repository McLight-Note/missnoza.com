/**
 * Telegram usernames as customers type them: "@miss_noza", "miss_noza",
 * "t.me/miss_noza" or "https://t.me/miss_noza". Stored without the "@".
 */
const USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/** Returns the bare username, "" for an empty field, or null when invalid. */
export function normalizeTelegram(input: string): string | null {
  let value = input.trim();
  if (!value) return "";
  value = value.replace(/^https?:\/\//i, "").replace(/^(www\.)?(t|telegram)\.me\//i, "");
  value = value.replace(/^@/, "").replace(/[/?#].*$/, "");
  return USERNAME.test(value) ? value : null;
}

/** Link that opens a chat with the username in Telegram. */
export function telegramUrl(username: string) {
  return `https://t.me/${encodeURIComponent(username)}`;
}
