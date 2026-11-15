import Link from "next/link";
import { siteConfig } from "@/config/site";
import type { Category, ContactDetails } from "@/lib/types";

/** Only link out to http(s) addresses saved in settings. */
function safeExternal(url: string) {
  return /^https?:\/\//i.test(url) ? url : null;
}

export function SiteFooter({ categories, contact, year }: { categories: Category[]; contact: ContactDetails; year: number }) {
  const instagram = safeExternal(contact.instagram);
  const telegram = safeExternal(contact.telegram);
  return (
    <footer className="mt-16 border-t border-line bg-sand/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="font-display text-2xl font-semibold">{siteConfig.name}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{siteConfig.tagline}.</p>
        </div>
        <nav aria-label="Doʻkon">
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Doʻkon</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/products" className="text-muted hover:text-ink hover:underline">
                Barcha mahsulotlar
              </Link>
            </li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/products?category=${c.slug}`} className="text-muted hover:text-ink hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Yordam">
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Yordam</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/contact" className="text-muted hover:text-ink hover:underline">
                Aloqa va yetkazib berish
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-muted hover:text-ink hover:underline">
                Maxfiylik
              </Link>
            </li>
            <li>
              <Link href="/account" className="text-muted hover:text-ink hover:underline">
                Shaxsiy kabinet
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-sm font-semibold tracking-wide uppercase">Aloqa</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {contact.phone && (
              <li>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-ink hover:underline">
                  {contact.phone}
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="hover:text-ink hover:underline">
                  {contact.email}
                </a>
              </li>
            )}
            {contact.address && <li>{contact.address}</li>}
            {contact.hours && <li>{contact.hours}</li>}
            {instagram && (
              <li>
                <a href={instagram} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                  Instagram
                </a>
              </li>
            )}
            {telegram && (
              <li>
                <a href={telegram} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                  Telegram
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs text-muted">
          © {year} {siteConfig.name}. Buyurtmalar telefon orqali tasdiqlanadi va yetkazib berilganda toʻlanadi.
        </p>
      </div>
    </footer>
  );
}
