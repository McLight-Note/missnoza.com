import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { DateRangeForm } from "@/components/admin/date-range-form";
import { Notice } from "@/components/ui/form";
import { Badge, Card, PageLoading } from "@/components/ui/misc";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/types";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { getDashboard } from "@/server/admin/data";
import { adminRange } from "@/server/admin/presets";
import { requireAdminPage } from "@/server/auth";
import { isEmailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Boshqaruv paneli" };

export default function DashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<PageLoading label="Panel yuklanmoqda…" />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdminPage("/admin");
  const params = await searchParams;
  const { range, presets } = adminRange(params.from, params.to);
  const data = await getDashboard(range.start, range.end);
  const rangeQuery = `from=${range.fromDay}&to=${range.toDay}`;

  return (
    <>
      <AdminPageHeader
        title="Boshqaruv paneli"
        description={`${formatDate(range.start)} – ${formatDate(range.end - 1)} · bekor qilingan buyurtmalar tushum va sotilgan donalarga qoʻshilmaydi`}
      />

      <DateRangeForm action="/admin" from={range.fromDay} to={range.toDay} presets={presets} />

      {!isEmailConfigured() && (
        <Notice tone="warning" title="Buyurtma xatlari sozlanmagan" className="mt-4">
          Yangi buyurtmalar saqlanadi, lekin RESEND_API_KEY va EMAIL_FROM sozlanmaguncha xabarnoma xati yuborilmaydi. README fayliga qarang.
        </Notice>
      )}
      {data.truncated && (
        <Notice tone="warning" className="mt-4">
          Bu davrda buyurtmalar panel bir yoʻla yuklay oladiganidan koʻp, shuning uchun jami sonlar toʻliq emas. Qisqaroq davrni tanlang.
        </Notice>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Buyurtmalar"
          value={String(data.orderCount)}
          hint={data.cancelledCount > 0 ? `${data.cancelledCount} tasi bekor qilingan` : undefined}
        />
        <Stat label="Tushum" value={formatMoney(data.revenue)} hint={`Oʻrtacha buyurtma: ${formatMoney(data.averageOrder)}`} />
        <Stat label="Sotilgan (dona)" value={String(data.unitsSold)} />
        <Stat label="Kam qolgan mahsulotlar" value={String(data.lowStock.length)} hint={`${data.lowStockThreshold} ta yoki undan kam`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ORDER_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/orders?${rangeQuery}&status=${status}`}
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm hover:border-brand-300"
          >
            {ORDER_STATUS_LABELS[status]} <span className="font-bold tabular-nums">{data.byStatus[status]}</span>
          </Link>
        ))}
      </div>

      {data.emailIssues.length > 0 && (
        <Card className="mt-6 border-danger/30 p-4 sm:p-5">
          <h2 className="font-sans text-base font-bold text-danger">Eʼtibor talab qiladigan buyurtma xatlari</h2>
          <p className="mt-1 text-sm text-muted">
            Bu buyurtmalar saqlangan, lekin xabarnoma xati yetib bormagan. Qayta yuborish uchun buyurtmani oching.
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {data.emailIssues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/orders/${issue.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                  {issue.reference}
                </Link>
                <span className="text-muted">{formatDateTime(issue.createdAt)}</span>
                <span className="w-full truncate text-xs text-muted">{issue.error ?? "Yuborish yakunlanmagan"}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <h2 className="font-sans text-base font-bold">Mahsulotlar boʻyicha savdo</h2>
            <p className="mt-1 text-sm text-muted">Tanlangan davrdagi sotilgan donalar va tushum.</p>
          </div>
          {data.sales.length === 0 ? (
            <p className="border-t border-line p-5 text-sm text-muted">Bu davrda savdo boʻlmagan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-sand text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold sm:px-5">
                      Mahsulot
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                      Dona
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold sm:px-5">
                      Tushum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.sales.map((row) => (
                    <tr key={row.productId}>
                      <td className="px-4 py-3 sm:px-5">
                        <Link href={`/admin/products/${row.productId}`} className="font-medium hover:underline">
                          {row.name}
                        </Link>
                        {row.variants.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted">{row.variants.map((v) => `${v.name} × ${v.units}`).join(" · ")}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.units}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="self-start overflow-hidden">
          <div className="p-4 sm:p-5">
            <h2 className="font-sans text-base font-bold">Kam qolganlar</h2>
            <p className="mt-1 text-sm text-muted">Hozirgi qoldiq (davrga bogʻliq emas).</p>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="border-t border-line p-5 text-sm text-muted">Barcha mahsulotlar yetarli.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line text-sm">
              {data.lowStock.slice(0, 30).map((item) => (
                <li key={`${item.id}-${item.label}`} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <Link href={`/admin/products/${item.id}`} className="min-w-0 hover:underline">
                    <span className="font-medium">{item.name}</span>
                    {item.label && <span className="text-muted"> · {item.label}</span>}
                    {!item.active && <span className="text-muted"> (yashirilgan)</span>}
                  </Link>
                  <Badge tone={item.stock === 0 ? "danger" : "warning"}>{item.stock === 0 ? "Tugagan" : `${item.stock} ta qoldi`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
