import { cacheLife } from "next/cache";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { getCatalog, getPublicSettings } from "@/server/catalog";

async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [catalog, settings, year] = await Promise.all([getCatalog(), getPublicSettings(), currentYear()]);
  return (
    <>
      {settings.announcement && (
        <p className="bg-brand-800 px-4 py-2 text-center text-xs font-medium tracking-wide text-white sm:text-sm">
          {settings.announcement}
        </p>
      )}
      <SiteHeader categories={catalog.categories} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter categories={catalog.categories} contact={settings.contact} year={year} />
    </>
  );
}
