import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Card } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { adminBasePath } from "@/lib/admin-path";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Admin kirish", robots: { index: false, follow: false } };

// Rendered per request: it reads the session and the (hidden) admin address.
export const instant = false;

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-sand/50 px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-3xl font-semibold">
          {siteConfig.name} <span className="font-sans text-xs font-semibold tracking-wide text-brand-700 uppercase">Admin</span>
        </h1>
        <Card className="mt-6 p-5 sm:p-6">
          <Suspense fallback={<div className="skeleton h-48 w-full" />}>
            <Login />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}

async function Login() {
  const session = await getSession();
  const base = adminBasePath();
  if (session?.isAdmin) redirect(base);
  return <AdminLoginForm afterLogin={base} />;
}
