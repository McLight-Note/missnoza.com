"use client";

import { useCallback, useEffect, useState } from "react";
import { quoteCart, type CartQuote } from "@/app/actions/shop";
import type { CartLine } from "@/lib/cart";

type State = { lines: CartLine[] | null; attempt: number; quote: CartQuote | null; error: string | null };

/**
 * Ask the server for current prices and availability for the cart.
 * Re-runs whenever the cart changes, and on demand via `refresh()`.
 */
export function useCartQuote(lines: CartLine[]) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ lines: null, attempt: 0, quote: null, error: null });

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    const payload = lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
    quoteCart(payload)
      .then((result) => {
        if (cancelled) return;
        setState({
          lines,
          attempt,
          quote: result.ok ? result.data : null,
          error: result.ok ? null : result.error,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ lines, attempt, quote: null, error: "Joriy narxlarni yuklab boʻlmadi. Internet aloqasini tekshirib, qayta urinib koʻring." });
      });
    return () => {
      cancelled = true;
    };
  }, [lines, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const current = state.lines === lines && state.attempt === attempt;

  return {
    /** The latest quote. May briefly be for the previous cart while `loading`. */
    quote: lines.length === 0 ? null : state.quote,
    /** True when `quote` matches the cart exactly as it is now. */
    fresh: current && state.quote !== null,
    loading: lines.length > 0 && !current,
    error: current ? state.error : null,
    refresh,
  };
}
