import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/utils";
import { getPublicSettings } from "@/server/catalog";

export const metadata: Metadata = {
  title: "Aloqa va yetkazib berish",
  description: `${siteConfig.name} bilan qanday bogʻlanish, qayerlarga yetkazib beramiz va yetkazib berish narxi.`,
  alternates: { canonical: "/contact" },
};

/*
 * Contact details, delivery areas and fees on this page come from
 * Admin → Settings (defaults live in src/config/site.ts).
 * The paragraphs of text are placeholders — edit them freely.
 */
export default async function ContactPage() {
  const { contact, deliveryAreas, freeDeliveryThreshold } = await getPublicSettings();
  const rows = [
    { icon: Phone, label: "Telefon", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : undefined },
    { icon: Mail, label: "Email", value: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
    { icon: MapPin, label: "Manzil", value: contact.address },
    { icon: Clock, label: "Ish vaqti", value: contact.hours },
  ].filter((row) => row.value);

  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <h1 className="text-3xl font-semibold sm:text-4xl">Aloqa va yetkazib berish</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Mahsulot yoki buyurtma boʻyicha savolingiz bormi? Biz bilan bogʻlaning — yordam berishdan mamnunmiz. Buyurtma haqida soʻrayotgan boʻlsangiz, buyurtma raqamini tayyorlab qoʻying.
      </p>

      <Card className="mt-6 divide-y divide-line">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-start gap-4 p-4 sm:p-5">
            <Icon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted">{label}</p>
              {href ? (
                <a href={href} className="font-medium underline-offset-4 hover:underline">
                  {value}
                </a>
              ) : (
                <p className="font-medium">{value}</p>
              )}
            </div>
          </div>
        ))}
      </Card>

      <h2 className="mt-10 text-2xl font-semibold">Yetkazib berish</h2>
      <p className="mt-2 leading-relaxed text-muted">
        Buyurtma berganingizdan soʻng uni tasdiqlash va yetkazib berish vaqtini kelishish uchun telefon orqali bogʻlanamiz. Toʻlov yetkazib berilganda amalga oshiriladi.
        {freeDeliveryThreshold !== null && ` ${formatMoney(freeDeliveryThreshold)} dan boshlab yetkazib berish bepul.`}
      </p>
      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-sand text-xs tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
                Hudud
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">
                Yetkazib berish narxi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {deliveryAreas.map((area) => (
              <tr key={area.id}>
                <td className="px-4 py-3 sm:px-5">{area.name}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums sm:px-5">
                  {area.fee === 0 ? "Bepul" : formatMoney(area.fee)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
