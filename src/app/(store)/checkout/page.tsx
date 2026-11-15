import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm, type CheckoutDefaults } from "@/components/store/checkout-form";
import { Skeleton } from "@/components/ui/misc";
import { formatPhone } from "@/lib/phone";
import { getSession } from "@/server/auth";
import { adminDb } from "@/server/firebase-admin";

export const metadata: Metadata = { title: "Buyurtmani rasmiylashtirish", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">Buyurtmani rasmiylashtirish</h1>
      <Suspense
        fallback={
          <div role="status">
            <span className="sr-only">Sahifa yuklanmoqda…</span>
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <CheckoutWithDefaults />
      </Suspense>
    </div>
  );
}

/** Pre-fill the form for signed-in customers from their own saved profile. */
async function CheckoutWithDefaults() {
  const defaults: CheckoutDefaults = { name: "", phone: "", email: "", address: "", areaId: "", signedIn: false };
  const session = await getSession();
  if (session) {
    defaults.signedIn = true;
    defaults.email = session.email ?? "";
    try {
      const profile = (await adminDb().collection("users").doc(session.uid).get()).data() ?? {};
      if (typeof profile.name === "string") defaults.name = profile.name;
      if (typeof profile.phone === "string" && profile.phone) defaults.phone = formatPhone(profile.phone);
      if (typeof profile.address === "string") defaults.address = profile.address;
      if (typeof profile.areaId === "string") defaults.areaId = profile.areaId;
    } catch (error) {
      console.error("[checkout] could not load profile", error);
    }
  }
  return <CheckoutForm defaults={defaults} />;
}
