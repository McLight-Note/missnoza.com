"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Price, ProductImage } from "@/components/store/product-card";
import { Button, buttonClass } from "@/components/ui/button";
import { cart, lineKey, useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import type { PublicProduct } from "@/lib/types";

export function ProductGallery({ product }: { product: PublicProduct }) {
  const [index, setIndex] = useState(0);
  const images = product.images;
  const active = images[Math.min(index, Math.max(0, images.length - 1))];
  return (
    <div>
      <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-sand">
        <ProductImage src={active?.url} alt={active?.alt || product.name} priority />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Mahsulot rasmlari">
          {images.map((image, i) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${images.length} ta rasmdan ${i + 1}-chisini koʻrsatish`}
                aria-current={i === index}
                className={cn(
                  "block size-16 overflow-hidden rounded-xl border-2 bg-sand sm:size-20",
                  i === index ? "border-brand-600" : "border-transparent hover:border-brand-200",
                )}
              >
                <ProductImage src={image.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Quantity({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface" role="group" aria-label="Miqdor">
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Miqdorni kamaytirish"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-8 text-center text-base font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="flex size-11 items-center justify-center rounded-full hover:bg-sand disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Miqdorni oshirish"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ProductPurchase({ product }: { product: PublicProduct }) {
  const hasVariants = product.variants.length > 0;
  const firstAvailable = product.variants.find((v) => v.available > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState<string | null>(hasVariants ? (firstAvailable?.id ?? null) : null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const lines = useCart();

  // Page state is kept while hidden; do not show a stale "added" message on return.
  useLayoutEffect(() => {
    return () => setAdded(false);
  }, []);

  const variant = hasVariants ? product.variants.find((v) => v.id === variantId) : undefined;
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAtPrice : hasVariants ? null : product.compareAtPrice;
  const available = variant ? variant.available : hasVariants ? 0 : product.available;
  const inCart = lines.find((l) => lineKey(l) === lineKey({ productId: product.id, variantId }))?.quantity ?? 0;
  const canAdd = Math.max(0, available - inCart);
  const soldOut = available === 0;
  const qty = Math.min(quantity, Math.max(1, canAdd));

  const add = () => {
    if (canAdd === 0) return;
    cart.add({
      productId: product.id,
      variantId,
      quantity: qty,
      snapshot: {
        name: product.name,
        variantName: variant?.name ?? null,
        slug: product.slug,
        image: product.images[0]?.url ?? null,
        unitPrice: price,
      },
    });
    setQuantity(1);
    setAdded(true);
  };

  return (
    <div className="space-y-6">
      <Price price={price} compareAtPrice={compareAt} size="lg" />

      {hasVariants && (
        <fieldset>
          <legend className="text-sm font-medium">
            {product.optionLabel || "Variant"}
            {variant && <span className="ml-1.5 font-normal text-muted">{variant.name}</span>}
          </legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {product.variants.map((v) => {
              const selected = v.id === variantId;
              const out = v.available === 0;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600",
                    selected ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-surface hover:border-brand-300",
                    out && "text-muted line-through decoration-muted/60",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={selected}
                    onChange={() => {
                      setVariantId(v.id);
                      setQuantity(1);
                      setAdded(false);
                    }}
                    className="sr-only"
                  />
                  {v.swatch && (
                    <span aria-hidden="true" className="size-4 rounded-full border border-black/10" style={{ backgroundColor: v.swatch }} />
                  )}
                  {v.name}
                  {out && <span className="sr-only"> (tugagan)</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <p className={cn("text-sm font-medium", soldOut ? "text-danger" : available <= 3 ? "text-warning" : "text-success")} role="status">
        {soldOut ? "Tugagan" : available <= 3 ? `Faqat ${available} ta qoldi` : "Sotuvda bor"}
      </p>

      {!soldOut && (
        <div className="flex flex-wrap items-center gap-3">
          <Quantity value={qty} max={Math.max(1, canAdd)} onChange={setQuantity} />
          <Button size="lg" onClick={add} disabled={canAdd === 0} className="min-w-44 flex-1 sm:flex-none">
            <ShoppingBag className="size-4" aria-hidden="true" />
            {canAdd === 0 ? "Savatda maksimal miqdor" : "Savatga qoʻshish"}
          </Button>
        </div>
      )}

      <div aria-live="polite">
        {added && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/25 bg-success-soft px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-success">
              <Check className="size-4" aria-hidden="true" /> Savatga qoʻshildi
            </span>
            <Link href="/cart" className={buttonClass({ size: "sm" }, "ml-auto")}>
              Savatni koʻrish
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
