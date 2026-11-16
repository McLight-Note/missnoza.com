import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CircleCheck, Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageLoading, StatusBadge } from "@/components/ui/misc";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validation";
import { isAdminConfigured } from "@/server/firebase-admin";
import { getPublicSettings } from "@/server/catalog";
import { getOrderConfirmation } from "@/server/orders";

export const metadata: Metadata = { title: "Buyurtma qabul qilindi", robots: { index: false, follow: false } };

export default function OrderPage({ params }: PageProps<"/order/[id]">) {
  return (
    <div className="container-page max-w-2xl py-8 sm:py-12">
      <Suspense fallback={<PageLoading label="Buyurtma yuklanmoqda…" />}>
        <Confirmation params={params} />
      </Suspense>
    </div>
  );
}

async function Confirmation({ params }: Pick<PageProps<"/order/[id]">, "params">) {
  await connection(); // orders are loaded per request, never prerendered or prefetched
  const { id } = await params;
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success || !isAdminConfigured()) notFound();
  const [order, settings] = await Promise.all([getOrderConfirmation(parsed.data), getPublicSettings()]);
  if (!order) notFound();
  // Only link to a Telegram address saved in Admin → Sozlamalar.
  const telegram = /^https:\/\/(t\.me|telegram\.me)\//i.test(settings.contact.telegram) ? settings.contact.telegram : null;
  const cancelled = order.status === "cancelled";

  return (
    <>
      <div className="text-center">
        <CircleCheck className="mx-auto size-12 text-success" aria-hidden="true" />
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          {cancelled ? "Bu buyurtma bekor qilingan" : `Rahmat${order.customerFirstName ? `, ${order.customerFirstName}` : ""}!`}
        </h1>
        {!cancelled && (
          <p className="mx-auto mt-2 max-w-md text-muted">
            Buyurtmangiz qabul qilindi. Yetkazib berishni tasdiqlash uchun {order.phoneMasked} raqamiga bogʻlanamiz.
          </p>
        )}
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Buyurtma raqami</p>
            <p className="font-mono text-xl font-bold tracking-wide select-all">{order.reference}</p>
            <p className="mt-1 text-sm text-muted">{formatDateTime(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
          {order.items.map((item) => (
            <li key={`${item.productId}-${item.variantId}`} className="flex justify-between gap-3 py-3">
              <span>
                <span className="font-medium">{item.name}</span>
                {item.variantName && <span className="text-muted"> · {item.variantName}</span>}
                <span className="text-muted"> × {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Mahsulotlar</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Yetkazib berish ({order.areaName})</dt>
            <dd className="tabular-nums">{order.deliveryFee === 0 ? "Bepul" : formatMoney(order.deliveryFee)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3 text-base">
            <dt className="font-semibold">Yetkazilganda toʻlanadigan jami summa</dt>
            <dd className="text-lg font-bold tabular-nums">{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </Card>

      {telegram && !cancelled && (
        <Card className="mt-5 p-5 text-center sm:p-6">
          <p className="font-semibold">Buyurtmani Telegramda tasdiqlang</p>
          <p className="mt-1 text-sm text-muted">
            Bizga Telegramda <strong className="font-mono text-ink select-all">{order.reference}</strong> buyurtma raqamini yozing — tezroq bogʻlanamiz.
          </p>
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#229ED9] px-7 text-base font-medium text-white hover:bg-[#1c8cc2] sm:w-auto"
          >
            <Send className="size-5" aria-hidden="true" />
            Telegramda yozish
          </a>
        </Card>
      )}

      <p className="mt-5 text-center text-sm text-muted">
        Biz bilan bogʻlanish kerak boʻlsa, buyurtma raqamini saqlab qoʻying. Saytda hech qanday toʻlov olinmadi.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/products">Xaridni davom ettirish</ButtonLink>
        <ButtonLink href="/contact" variant="secondary">
          Biz bilan bogʻlanish
        </ButtonLink>
      </div>
    </>
  );
}
