import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm, SignOutButton } from "@/components/store/account-forms";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageLoading, StatusBadge } from "@/components/ui/misc";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatMoney } from "@/lib/utils";
import { requireUserPage } from "@/server/auth";
import { getPublicSettings } from "@/server/catalog";
import { adminDb } from "@/server/firebase-admin";
import { getOrdersForUser } from "@/server/orders";

export const metadata: Metadata = { title: "Shaxsiy kabinet", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="container-page max-w-3xl py-8 sm:py-10">
      <Suspense fallback={<PageLoading label="Kabinet yuklanmoqda…" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  // Everything below is loaded for the signed-in user's own ID only.
  const session = await requireUserPage("/account");
  const [profileSnap, orders, settings] = await Promise.all([
    adminDb().collection("users").doc(session.uid).get(),
    getOrdersForUser(session.uid),
    getPublicSettings(),
  ]);
  const profile = profileSnap.data() ?? {};
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Shaxsiy kabinet</h1>
          <p className="mt-1 text-sm text-muted">Siz {session.email} sifatida kirgansiz</p>
        </div>
        <div className="flex gap-2">
          {session.isAdmin && (
            <ButtonLink href="/admin" size="sm">
              Admin panel
            </ButtonLink>
          )}
          <SignOutButton />
        </div>
      </div>

      <section aria-labelledby="orders-heading" className="mt-8">
        <h2 id="orders-heading" className="text-2xl font-semibold">
          Buyurtmalaringiz
        </h2>
        {orders.length === 0 ? (
          <Card className="mt-4 p-6 text-sm text-muted">
            Tizimga kirgan holda bergan buyurtmalaringiz shu yerda koʻrinadi.{" "}
            <Link href="/products" className="font-medium text-brand-700 underline-offset-4 hover:underline">
              Mahsulotlarni koʻrish
            </Link>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold">{order.reference}</p>
                      <p className="text-sm text-muted">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      <p className="font-semibold tabular-nums">{formatMoney(order.total)}</p>
                    </div>
                  </div>
                  <ul className="mt-3 border-t border-line pt-3 text-sm text-muted">
                    {order.items.map((item) => (
                      <li key={`${item.productId}-${item.variantId}`}>
                        {item.name}
                        {item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="details-heading" className="mt-10">
        <h2 id="details-heading" className="text-2xl font-semibold">
          Yetkazib berish maʼlumotlari
        </h2>
        <p className="mt-1 text-sm text-muted">Saqlangan maʼlumotlar buyurtma berishda avtomatik toʻldiriladi.</p>
        <Card className="mt-4 p-5">
          <ProfileForm
            areas={settings.deliveryAreas}
            initial={{
              name: text(profile.name),
              phone: text(profile.phone) ? formatPhone(text(profile.phone)) : "",
              address: text(profile.address),
              areaId: text(profile.areaId),
            }}
          />
        </Card>
      </section>
    </>
  );
}
