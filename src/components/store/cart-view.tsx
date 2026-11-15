"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/store/product-card";
import { useCartQuote } from "@/components/store/use-cart-quote";
import { Button, ButtonLink, Spinner } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { Card, EmptyState, Skeleton } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { cart, lineKey, useCart, useHydrated } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";

export function CartView() {
  const hydrated = useHydrated();
  const lines = useCart();
  const { quote, fresh, loading, error, refresh } = useCartQuote(lines);

  if (!hydrated) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Savat yuklanmoqda…</span>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="size-6" aria-hidden="true" />}
        title="Savatingiz boʻsh"
        action={<ButtonLink href="/products">Mahsulotlarni koʻrish</ButtonLink>}
      >
        Yoqqan mahsulotni savatga qoʻshing — u shu yerda koʻrinadi.
      </EmptyState>
    );
  }

  const quoted = new Map((quote?.lines ?? []).map((l) => [l.key, l]));
  const canCheckout = fresh && quote !== null && !quote.hasIssues && quote.ordersEnabled;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-4">
        {error && (
          <Notice tone="error" title="Narxlarni yangilab boʻlmadi">
            {error}{" "}
            <button type="button" onClick={refresh} className="font-semibold underline">
              Qayta urinish
            </button>
          </Notice>
        )}
        {fresh && quote?.hasIssues && (
          <Notice tone="warning" title="Savatingizni tekshiring">
            Ayrim mahsulotlar tugagan yoki siz tanlagan miqdorda qolmagan. Davom etish uchun ularni oʻzgartiring yoki olib tashlang.
          </Notice>
        )}

        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {lines.map((line) => {
            const key = lineKey(line);
            const q = quoted.get(key);
            const name = q?.status === "unavailable" && !q.slug ? q.name : (q?.name ?? line.snapshot.name);
            const variantName = q ? q.variantName : line.snapshot.variantName;
            const unitPrice = q && q.status !== "unavailable" ? q.unitPrice : line.snapshot.unitPrice;
            const max = q ? Math.max(1, Math.min(q.available, siteConfig.order.maxQuantityPerItem)) : siteConfig.order.maxQuantityPerItem;
            const unavailable = q?.status === "unavailable";
            return (
              <li key={key} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link href={`/products/${q?.slug || line.snapshot.slug}`} className="block size-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:size-24" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={q?.image ?? line.snapshot.image} alt="" className={unavailable ? "opacity-50" : undefined} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/products/${q?.slug || line.snapshot.slug}`} className="font-medium hover:underline">
                        {name}
                      </Link>
                      {variantName && <p className="text-sm text-muted">{variantName}</p>}
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatMoney(unitPrice * line.quantity)}</p>
                  </div>

                  {unavailable && <p className="mt-1 text-sm font-medium text-danger">Endi mavjud emas</p>}
                  {q?.status === "insufficient" && (
                    <p className="mt-1 text-sm font-medium text-warning">
                      Faqat {q.available} ta bor.{" "}
                      <button type="button" className="underline" onClick={() => cart.setQuantity(key, q.available)}>
                        Miqdorni yangilash
                      </button>
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <div className="inline-flex items-center rounded-full border border-line" role="group" aria-label={`${name} miqdori`}>
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40"
                        onClick={() => cart.setQuantity(key, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label="Miqdorni kamaytirish"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="min-w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40"
                        onClick={() => cart.setQuantity(key, line.quantity + 1)}
                        disabled={unavailable || line.quantity >= max}
                        aria-label="Miqdorni oshirish"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <Button variant="dangerGhost" size="sm" onClick={() => cart.remove(key)} aria-label={`${name} — olib tashlash`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Olib tashlash</span>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Card className="p-5 lg:sticky lg:top-24">
        <h2 className="font-sans text-lg font-semibold">Buyurtma xulosasi</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Mahsulotlar</dt>
            <dd className="font-semibold tabular-nums">
              {quote ? formatMoney(quote.subtotal) : <Spinner className="text-muted" />}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Yetkazib berish</dt>
            <dd className="text-muted">Rasmiylashtirishda hisoblanadi</dd>
          </div>
        </dl>
        {quote && !quote.ordersEnabled && (
          <Notice tone="warning" className="mt-4">
            Doʻkon hozircha onlayn buyurtma qabul qilmayapti. Keyinroq qayta kiring.
          </Notice>
        )}
        {canCheckout ? (
          <ButtonLink href="/checkout" size="lg" className="mt-5 w-full">
            Buyurtmani rasmiylashtirish
          </ButtonLink>
        ) : (
          <Button size="lg" className="mt-5 w-full" disabled loading={loading}>
            Buyurtmani rasmiylashtirish
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-muted">Toʻlov yetkazib berilganda. Karta kerak emas.</p>
      </Card>
    </div>
  );
}
