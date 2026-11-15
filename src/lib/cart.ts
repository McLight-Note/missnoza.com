"use client";

import { useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";

/**
 * The shopping cart lives in the browser (localStorage). It only stores what
 * the customer chose — product, option, quantity — plus a snapshot of the
 * name/price for instant display. Real prices and stock are always re-read
 * from the server before anything is shown as a total or submitted.
 */

export type CartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  snapshot: { name: string; variantName: string | null; slug: string; image: string | null; unitPrice: number };
};

const STORAGE_KEY = "missnoza.cart.v1";
const EMPTY: CartLine[] = [];
const MAX_QTY = siteConfig.order.maxQuantityPerItem;

let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

export const lineKey = (l: { productId: string; variantId: string | null }) => `${l.productId}::${l.variantId ?? ""}`;

function read(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .filter(
        (l): l is CartLine =>
          Boolean(l) &&
          typeof l.productId === "string" &&
          (l.variantId === null || typeof l.variantId === "string") &&
          Number.isInteger(l.quantity) &&
          l.quantity > 0 &&
          typeof l.snapshot === "object" &&
          l.snapshot !== null,
      )
      .slice(0, siteConfig.order.maxLines)
      .map((l) => ({ ...l, quantity: Math.min(l.quantity, MAX_QTY) }));
  } catch {
    return EMPTY;
  }
}

function commit(next: CartLine[]) {
  lines = next.length === 0 ? EMPTY : next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage full or blocked: the cart still works for this page view.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    lines = read();
  }
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    lines = read();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    lines = read();
  }
  return lines;
}

/** Cart lines. Empty during server rendering and until the browser loads them. */
export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** True once the component is running in the browser (cart has been read). */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export const cart = {
  add(line: CartLine) {
    const current = getSnapshot();
    const key = lineKey(line);
    const existing = current.find((l) => lineKey(l) === key);
    if (existing) {
      commit(
        current.map((l) =>
          lineKey(l) === key
            ? { ...l, quantity: Math.min(l.quantity + line.quantity, MAX_QTY), snapshot: line.snapshot }
            : l,
        ),
      );
    } else if (current.length < siteConfig.order.maxLines) {
      commit([...current, { ...line, quantity: Math.min(line.quantity, MAX_QTY) }]);
    }
  },
  setQuantity(key: string, quantity: number) {
    const q = Math.max(1, Math.min(Math.trunc(quantity) || 1, MAX_QTY));
    commit(getSnapshot().map((l) => (lineKey(l) === key ? { ...l, quantity: q } : l)));
  },
  remove(key: string) {
    commit(getSnapshot().filter((l) => lineKey(l) !== key));
  },
  clear() {
    commit([]);
  },
};

export function cartCount(current: CartLine[]) {
  return current.reduce((sum, l) => sum + l.quantity, 0);
}
