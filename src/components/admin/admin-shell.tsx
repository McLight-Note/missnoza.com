"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { ClipboardList, ExternalLink, History, LayoutDashboard, LogOut, Package, Settings, Tags } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Boshqaruv paneli", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Buyurtmalar", icon: ClipboardList },
  { href: "/admin/products", label: "Mahsulotlar", icon: Package },
  { href: "/admin/categories", label: "Kategoriyalar", icon: Tags },
  { href: "/admin/settings", label: "Sozlamalar", icon: Settings },
  { href: "/admin/activity", label: "Amallar tarixi", icon: History },
];

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await signOutAction();
      router.replace("/");
      router.refresh();
    });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-sand/50 lg:flex-row">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-5">
          <Link href="/admin" className="font-display text-xl font-semibold">
            {siteConfig.name} <span className="font-sans text-xs font-semibold tracking-wide text-brand-700 uppercase">Admin</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-sand hover:text-ink lg:hidden"
          >
            <LogOut className="size-4" aria-hidden="true" /> Chiqish
          </button>
        </div>
        <nav aria-label="Admin menyu" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-medium",
                  active ? "bg-brand-50 text-brand-800" : "text-ink hover:bg-sand",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden space-y-1 border-t border-line p-3 lg:block">
          <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-muted hover:bg-sand hover:text-ink">
            <ExternalLink className="size-4" aria-hidden="true" /> Doʻkonni koʻrish
          </Link>
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-muted hover:bg-sand hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden="true" /> Chiqish
          </button>
          <p className="truncate px-3 pt-1 text-xs text-muted" title={email}>
            {email}
          </p>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-sans text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
