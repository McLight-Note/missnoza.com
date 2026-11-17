"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, useTransition, type FormEvent } from "react";
import { ShoppingBag } from "lucide-react";
import { placeOrder } from "@/app/actions/shop";
import { useCartQuote } from "@/components/store/use-cart-quote";
import { Button, ButtonLink, Spinner } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea, fieldAria } from "@/components/ui/form";
import { Card, EmptyState, Skeleton } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { cart, lineKey, useCart, useHydrated } from "@/lib/cart";
import { deliveryFeeFor } from "@/lib/pricing";
import { normalizeTelegram } from "@/lib/telegram";
import { formatMoney } from "@/lib/utils";

const KEY_STORAGE = "missnoza.checkout.v1";

/**
 * One idempotency key per distinct cart. Submitting the same cart twice
 * (double click, retry after a dropped connection) reuses the key, so the
 * server returns the first order instead of creating a second one.
 */
function idempotencyKeyFor(signature: string) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY_STORAGE) || "null") as { key: string; signature: string } | null;
    if (saved && saved.signature === signature && typeof saved.key === "string") return saved.key;
  } catch {
    // fall through to a new key
  }
  const key = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(KEY_STORAGE, JSON.stringify({ key, signature }));
  } catch {
    // sessionStorage unavailable: still safe, just without retry de-duplication
  }
  return key;
}

export function CheckoutForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart();
  const { quote, fresh, loading, error: quoteError, refresh } = useCartQuote(lines);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    telegram: "",
    areaId: "",
    address: "",
    notes: "",
    company: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState(false);

  // Next.js keeps this page's state while it is hidden. Clear the one-off
  // "order placed" and error states so coming back shows a usable form.
  useLayoutEffect(() => {
    return () => {
      setPlaced(false);
      setFormError(null);
      setFieldErrors({});
    };
  }, []);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  if (placed) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
        <Spinner className="size-6 text-brand-600" />
        <p className="font-medium">Buyurtma qabul qilindi — tasdiqlash sahifasi ochilmoqda…</p>
      </div>
    );
  }
  if (!hydrated) {
    return (
      <div role="status" className="space-y-3">
        <span className="sr-only">Sahifa yuklanmoqda…</span>
        <Skeleton className="h-64 w-full" />
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
        Buyurtma berish uchun avval savatga mahsulot qoʻshing.
      </EmptyState>
    );
  }

  const areas = quote?.deliveryAreas ?? [];
  const area = areas.find((a) => a.id === form.areaId);
  const subtotal = quote?.subtotal ?? 0;
  const deliveryFee = deliveryFeeFor(subtotal, area, quote?.freeDeliveryThreshold ?? null);
  const total = subtotal + deliveryFee;
  const blocked = !fresh || !quote || quote.hasIssues || !quote.ordersEnabled;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || blocked) return;

    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Ism va familiyangizni kiriting.";
    if (form.phone.trim().length < 5) errors.phone = "Telefon raqamingizni kiriting.";
    if (normalizeTelegram(form.telegram) === null) errors.telegram = "Telegram foydalanuvchi nomini kiriting, masalan: @miss_noza";
    if (!area) errors.areaId = "Yetkazib berish hududini tanlang.";
    if (form.address.trim().length < 5) errors.address = "Yetkazib berish manzilini kiriting.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Belgilangan maydonlarni toʻldiring.");
      document.getElementById(`checkout-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    setFormError(null);

    const signature = lines.map((l) => `${lineKey(l)}x${l.quantity}`).join("|");
    startTransition(async () => {
      try {
        const result = await placeOrder({
          idempotencyKey: idempotencyKeyFor(signature),
          lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
          name: form.name,
          phone: form.phone,
          telegram: form.telegram,
          areaId: form.areaId,
          address: form.address,
          notes: form.notes,
          expectedTotal: total,
          company: form.company,
        });
        if (result.ok) {
          setPlaced(true);
          setForm((f) => ({ ...f, notes: "" }));
          try {
            window.sessionStorage.removeItem(KEY_STORAGE);
          } catch {}
          cart.clear();
          router.push(`/order/${result.orderId}`);
          return;
        }
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        if (result.code === "CART_INVALID" || result.code === "TOTAL_CHANGED") refresh();
      } catch {
        setFormError("Doʻkon bilan bogʻlanib boʻlmadi. Internet aloqasini tekshirib, qayta urinib koʻring — buyurtma ikki marta yozilmaydi.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="font-sans text-lg font-semibold">Aloqa maʼlumotlari</h2>
          <Field id="checkout-name" label="Ism va familiya" error={fieldErrors.name}>
            <Input {...fieldAria("checkout-name", fieldErrors.name)} name="name" autoComplete="name" required maxLength={80} value={form.name} onChange={set("name")} />
          </Field>
          <Field
            id="checkout-phone"
            label="Telefon raqam"
            hint={`Yetkazib berishni tasdiqlash uchun shu raqamga qoʻngʻiroq qilamiz yoki yozamiz. Masalan: ${siteConfig.phone.example}`}
            error={fieldErrors.phone}
          >
            <Input
              {...fieldAria("checkout-phone", fieldErrors.phone, true)}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={32}
              value={form.phone}
              onChange={set("phone")}
            />
          </Field>
          <Field
            id="checkout-telegram"
            label="Telegram"
            optional
            hint="Foydalanuvchi nomingiz, masalan: @miss_noza. Nomingiz boʻlmasa, telefon raqamingiz orqali topamiz."
            error={fieldErrors.telegram}
          >
            <Input
              {...fieldAria("checkout-telegram", fieldErrors.telegram, true)}
              name="telegram"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={100}
              placeholder="@"
              value={form.telegram}
              onChange={set("telegram")}
            />
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-sans text-lg font-semibold">Yetkazib berish</h2>
          <Field id="checkout-areaId" label="Yetkazib berish hududi" error={fieldErrors.areaId}>
            <Select {...fieldAria("checkout-areaId", fieldErrors.areaId)} name="areaId" required value={area ? form.areaId : ""} onChange={set("areaId")} disabled={!quote}>
              <option value="" disabled>
                {quote ? "Hududni tanlang" : "Hududlar yuklanmoqda…"}
              </option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {formatMoney(a.fee)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="checkout-address" label="Yetkazib berish manzili" hint="Koʻcha, uy, xonadon va kerak boʻlsa moʻljal." error={fieldErrors.address}>
            <Textarea
              {...fieldAria("checkout-address", fieldErrors.address, true)}
              name="address"
              autoComplete="street-address"
              required
              maxLength={300}
              rows={3}
              value={form.address}
              onChange={set("address")}
            />
          </Field>
          <Field id="checkout-notes" label="Buyurtmaga izoh" optional hint="Masalan, qulay yetkazib berish vaqti." error={fieldErrors.notes}>
            <Textarea {...fieldAria("checkout-notes", fieldErrors.notes, true)} name="notes" maxLength={500} rows={2} value={form.notes} onChange={set("notes")} />
          </Field>
          {/* Honeypot field: hidden from people, tempting for bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
            <label>
              Company
              <input type="text" name="company" tabIndex={-1} autoComplete="off" value={form.company} onChange={set("company")} />
            </label>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-sans text-lg font-semibold">Toʻlov</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <strong className="text-ink">Toʻlov yetkazib berilganda.</strong> Bu — buyurtma soʻrovi: saytda onlayn toʻlov olinmaydi. Buyurtmani tasdiqlash uchun siz bilan bogʻlanamiz, toʻlov esa mahsulot yetkazilganda amalga oshiriladi.
          </p>
        </Card>
      </div>

      <Card className="p-5 lg:sticky lg:top-24">
        <h2 className="font-sans text-lg font-semibold">Buyurtmangiz</h2>

        {quoteError && (
          <Notice tone="error" className="mt-3">
            {quoteError}{" "}
            <button type="button" onClick={refresh} className="font-semibold underline">
              Qayta urinish
            </button>
          </Notice>
        )}

        {quote ? (
          <ul className="mt-4 divide-y divide-line text-sm">
            {quote.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="font-medium">{l.name}</span>
                  {l.variantName && <span className="text-muted"> · {l.variantName}</span>}
                  <span className="text-muted"> × {l.quantity}</span>
                  {l.status !== "ok" && (
                    <span className="block font-medium text-danger">
                      {l.status === "unavailable" ? "Endi mavjud emas" : `Faqat ${l.available} ta bor`}
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">{l.status === "ok" ? formatMoney(l.unitPrice * l.quantity) : "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 space-y-2" role="status">
            <span className="sr-only">Buyurtma yuklanmoqda…</span>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}

        <dl className="mt-3 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Mahsulotlar</dt>
            <dd className="tabular-nums">{quote ? formatMoney(subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Yetkazib berish{area ? ` (${area.name})` : ""}</dt>
            <dd className="tabular-nums">{!quote ? "—" : !area ? "Hududni tanlang" : deliveryFee === 0 ? "Bepul" : formatMoney(deliveryFee)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3 text-base">
            <dt className="font-semibold">Yetkazilganda toʻlanadigan jami summa</dt>
            <dd className="text-lg font-bold tabular-nums" aria-live="polite">
              {quote && area ? formatMoney(total) : "—"}
            </dd>
          </div>
        </dl>
        {quote?.freeDeliveryThreshold != null && deliveryFee > 0 && (
          <p className="mt-2 text-xs text-muted">{formatMoney(quote.freeDeliveryThreshold)} dan boshlab yetkazib berish bepul.</p>
        )}

        {quote?.hasIssues && (
          <Notice tone="warning" className="mt-4">
            Ayrim mahsulotlarni tekshirish kerak.{" "}
            <Link href="/cart" className="font-semibold underline">
              Savatni koʻrish
            </Link>
          </Notice>
        )}
        {quote && !quote.ordersEnabled && (
          <Notice tone="warning" className="mt-4">
            Doʻkon hozircha onlayn buyurtma qabul qilmayapti.
          </Notice>
        )}
        {formError && (
          <Notice tone="error" className="mt-4">
            {formError}
          </Notice>
        )}

        <Button type="submit" size="lg" className="mt-5 w-full" loading={pending || loading} disabled={blocked}>
          {pending ? "Buyurtma yuborilmoqda…" : "Buyurtma berish"}
        </Button>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Buyurtma berish orqali u boʻyicha siz bilan bogʻlanishimizga rozilik bildirasiz. Batafsil:{" "}
          <Link href="/privacy" className="underline">
            maxfiylik sahifasi
          </Link>
          .
        </p>
      </Card>
    </form>
  );
}
