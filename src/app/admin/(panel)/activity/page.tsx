import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Card, EmptyState, PageLoading } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/utils";
import { listAudit } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: "Amallar tarixi" };

export default function ActivityPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Activity />
    </Suspense>
  );
}

async function Activity() {
  await requireAdminPage("/admin/activity");
  const entries = await listAudit();
  return (
    <>
      <AdminPageHeader title="Amallar tarixi" description="Admin panelda qilingan oʻzgarishlar roʻyxati (eng yangilari tepada)." />
      {entries.length === 0 ? (
        <EmptyState title="Hali amallar yoʻq">Mahsulot, narx, qoldiq, buyurtma va sozlamalardagi oʻzgarishlar shu yerda qayd etiladi.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3 sm:px-5">
                <p>{entry.summary}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {entry.actorEmail || "nomaʼlum"} · {formatDateTime(entry.createdAt)} · {entry.action}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
