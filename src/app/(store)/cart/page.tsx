import type { Metadata } from "next";
import { CartView } from "@/components/store/cart-view";

export const metadata: Metadata = { title: "Savat", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">Savat</h1>
      <CartView />
    </div>
  );
}
