import type { Metadata } from "next";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Buyurtmani rasmiylashtirish", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">Buyurtmani rasmiylashtirish</h1>
      <CheckoutForm />
    </div>
  );
}
