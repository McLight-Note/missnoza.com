import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageLoading, StatusBadge } from "@/components/ui/misc";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validation";
import { isAdminConfigured } from "@/server/firebase-admin";
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
  const order = await getOrderConfirmation(parsed.data);
  if (!order) notFound();
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
