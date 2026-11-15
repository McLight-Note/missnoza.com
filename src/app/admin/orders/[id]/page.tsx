import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { OrderNoteForm, OrderStatusForm, ResendEmailButton } from "@/components/admin/order-actions";
import { Badge, Card, PageLoading, StatusBadge } from "@/components/ui/misc";
import { formatPhone } from "@/lib/phone";
import { ORDER_STATUS_LABELS, type EmailState } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { orderIdSchema } from "@/lib/validation";
import { getOrder } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: "Buyurtma" };

export default function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Buyurtma yuklanmoqda…" />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}

function EmailLine({ label, state }: { label: string; state: EmailState }) {
  const tone = state.status === "sent" ? "success" : state.status === "failed" ? "danger" : "neutral";
  const text = { sent: "Yuborilgan", failed: "Yuborilmadi", pending: "Kutilmoqda", skipped: "Soʻralmagan" }[state.status];
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">{label}</span>
        <Badge tone={tone}>{text}</Badge>
      </div>
      {state.error && <p className="mt-1 text-xs break-words text-danger">{state.error}</p>}
      {state.lastAttemptAt && <p className="mt-0.5 text-xs text-muted">Oxirgi urinish: {formatDateTime(state.lastAttemptAt)}</p>}
    </div>
  );
}

async function OrderDetail({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  await requireAdminPage("/admin/orders");
  const { id } = await params;
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const order = await getOrder(parsed.data);
  if (!order) notFound();

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" /> Barcha buyurtmalar
      </Link>
      <AdminPageHeader
        title={`Buyurtma ${order.reference}`}
        description={`Berilgan vaqti: ${formatDateTime(order.createdAt)}`}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <h2 className="p-4 font-sans text-base font-bold sm:p-5">Mahsulotlar</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-sm">
                <thead className="bg-sand text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">
                      Mahsulot
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      Oʻsha paytdagi narx
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      Soni
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold sm:px-5">
                      Jami
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.items.map((item) => (
                    <tr key={`${item.productId}-${item.variantId}`}>
                      <td className="px-4 py-3 sm:px-5">
                        <Link href={`/admin/products/${item.productId}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        {item.variantName && (
                          <p className="text-xs text-muted">
                            {item.optionLabel ? `${item.optionLabel}: ` : ""}
                            {item.variantName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(item.unitPrice)}
                        {item.listPrice > item.unitPrice && (
                          <span className="block text-xs text-muted line-through">{formatMoney(item.listPrice)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-line p-4 text-sm sm:p-5">
              <div className="flex justify-between">
                <dt className="text-muted">Mahsulotlar</dt>
                <dd className="tabular-nums">{formatMoney(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Yetkazib berish ({order.delivery.areaName})</dt>
                <dd className="tabular-nums">{order.deliveryFee === 0 ? "Bepul" : formatMoney(order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between pt-1.5 text-base font-bold">
                <dt>Jami</dt>
                <dd className="tabular-nums">{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-sans text-base font-bold">Ichki izohlar</h2>
            {order.internalNotes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Hali izoh yoʻq.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {order.internalNotes
                  .toSorted((a, b) => b.createdAt - a.createdAt)
                  .map((note) => (
                    <li key={note.id} className="rounded-xl bg-sand px-3.5 py-2.5 text-sm">
                      <p className="whitespace-pre-line">{note.text}</p>
                      <p className="mt-1 text-xs text-muted">
                        {note.authorEmail} · {formatDateTime(note.createdAt)}
                      </p>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-4 border-t border-line pt-4">
              <OrderNoteForm orderId={order.id} />
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-sans text-base font-bold">Tarix</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {order.history.map((entry, index) => (
                <li key={index} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="font-medium">{ORDER_STATUS_LABELS[entry.status]}</span>
                    <span className="text-muted"> · {entry.byEmail ?? "xaridor"}</span>
                  </span>
                  <span className="text-muted">{formatDateTime(entry.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4 sm:p-5">
            <OrderStatusForm orderId={order.id} status={order.status} />
            {order.stockReleased && <p className="mt-3 text-xs text-muted">Bu buyurtmadagi mahsulotlar omborga qaytarilgan.</p>}
          </Card>

          <Card className="space-y-3 p-4 text-sm sm:p-5">
            <h2 className="font-sans text-base font-bold">Mijoz</h2>
            <p className="font-medium">{order.customer.name}</p>
            <p>
              <a href={`tel:${order.customer.phone}`} className="font-medium text-brand-700 underline-offset-4 hover:underline">
                {formatPhone(order.customer.phone)}
              </a>
            </p>
            {order.customer.email && (
              <p>
                <a href={`mailto:${order.customer.email}`} className="break-all text-brand-700 underline-offset-4 hover:underline">
                  {order.customer.email}
                </a>
              </p>
            )}
            <p className="text-xs text-muted">{order.userId ? "Hisob orqali berilgan" : "Roʻyxatdan oʻtmagan xaridor"}</p>
          </Card>

          <Card className="space-y-2 p-4 text-sm sm:p-5">
            <h2 className="font-sans text-base font-bold">Yetkazib berish</h2>
            <p className="font-medium">{order.delivery.areaName}</p>
            <p className="whitespace-pre-line">{order.delivery.address}</p>
            {order.notes && (
              <div className="mt-2 rounded-xl bg-sand px-3.5 py-2.5">
                <p className="text-xs font-semibold text-muted uppercase">Mijoz izohi</p>
                <p className="mt-0.5 whitespace-pre-line">{order.notes}</p>
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-4 sm:p-5">
            <h2 className="font-sans text-base font-bold">Xatlar</h2>
            <EmailLine label="Doʻkonga xabarnoma" state={order.emails.owner} />
            <EmailLine label="Mijozga tasdiq xati" state={order.emails.customer} />
            <ResendEmailButton orderId={order.id} />
          </Card>
        </div>
      </div>
    </>
  );
}
