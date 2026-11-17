import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { DateRangeForm } from "@/components/admin/date-range-form";
import { Input, Notice, Select } from "@/components/ui/form";
import { Card, EmptyState, PageLoading, StatusBadge } from "@/components/ui/misc";
import { formatPhone } from "@/lib/phone";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { listOrders } from "@/server/admin/data";
import { adminRange } from "@/server/admin/presets";
import { requireAdminPage } from "@/server/auth";
import { adminHref } from "@/lib/admin-path";

export const metadata: Metadata = { title: "Buyurtmalar" };

const itemCount = (order: { items: { quantity: number }[] }) => {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return `${count} ta mahsulot`;
};
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<PageLoading label="Buyurtmalar yuklanmoqda…" />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  await requireAdminPage();
  const params = await searchParams;
  const { range, presets } = adminRange(params.from, params.to);
  const statusParam = first(params.status);
  const status = (ORDER_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as OrderStatus) : undefined;
  const q = first(params.q).trim().slice(0, 80);
  const { orders, truncated } = await listOrders({ start: range.start, end: range.end, status, q });
  const keep = `${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <AdminPageHeader title="Buyurtmalar" description={`${orders.length} ta buyurtma koʻrsatilmoqda`} />

      <DateRangeForm action={adminHref("/orders")} from={range.fromDay} to={range.toDay} presets={presets} presetQuery={keep}>
        <div>
          <label htmlFor="orders-status" className="mb-1 block text-xs font-medium text-muted">
            Holat
          </label>
          <Select id="orders-status" name="status" defaultValue={status ?? ""} className="w-auto">
            <option value="">Barcha holatlar</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor="orders-q" className="mb-1 block text-xs font-medium text-muted">
            Qidiruv
          </label>
          <Input id="orders-q" type="search" name="q" defaultValue={q} placeholder="Buyurtma raqami, ism, telefon yoki email" maxLength={80} />
        </div>
      </DateRangeForm>

      {truncated && (
        <Notice tone="warning" className="mt-4">
          Bu davrdagi faqat oxirgi 300 ta buyurtma yuklangan. Eskiroqlarini koʻrish yoki qidirish uchun sanalarni toraytiring.
        </Notice>
      )}

      <div className="mt-4">
        {orders.length === 0 ? (
          <EmptyState title="Buyurtma topilmadi">Kengroq sana oraligʻi, boshqa holat yoki boshqa qidiruv soʻzini sinab koʻring.</EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={adminHref(`/orders/${order.id}`)}
                    className="grid gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-brand-50/60 sm:grid-cols-[9.5rem_1fr_auto_7.5rem] sm:items-center sm:px-5"
                  >
                    <div>
                      <p className="font-mono text-sm font-bold">{order.reference}</p>
                      <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{order.customer.name}</p>
                      <p className="truncate text-xs text-muted">
                        {formatPhone(order.customer.phone)} · {itemCount(order)} · {order.delivery.areaName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      {order.emails.owner.status === "failed" && <span className="text-xs font-semibold text-danger">Xat yuborilmadi</span>}
                      {order.telegramAlert.status === "failed" && (
                        <span className="text-xs font-semibold text-danger">Telegram yuborilmadi</span>
                      )}
                    </div>
                    <p className="text-sm font-bold tabular-nums sm:text-right">{formatMoney(order.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
