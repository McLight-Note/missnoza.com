import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageLoading } from "@/components/ui/misc";
import { adminBasePath } from "@/lib/admin-path";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

// Admin pages are always rendered per request for a verified admin; they are
// never part of a prerendered shell.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <div className="container-page py-10">
          <PageLoading label="Ruxsat tekshirilmoqda…" />
        </div>
      }
    >
      <Gate>{children}</Gate>
    </Suspense>
  );
}

/**
 * Nothing inside the admin area renders until the session cookie has been verified
 * with Firebase and carries the admin claim. Each page and every data
 * function repeats the check, so this gate is not the only line of defence.
 */
async function Gate({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return (
    <AdminShell email={session.email ?? ""} base={adminBasePath()}>
      {children}
    </AdminShell>
  );
}
