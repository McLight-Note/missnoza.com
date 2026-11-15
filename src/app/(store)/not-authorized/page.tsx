import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Ruxsat yoʻq", robots: { index: false } };

export default function NotAuthorizedPage() {
  return (
    <div className="container-page max-w-xl py-12">
      <EmptyState
        icon={<ShieldAlert className="size-6" aria-hidden="true" />}
        title="Bu boʻlim faqat doʻkon xodimlari uchun"
        action={<ButtonLink href="/">Doʻkonga qaytish</ButtonLink>}
      >
        Siz kirgan hisobda admin huquqi yoʻq. Agar doʻkon egasi boʻlsangiz, admin sifatida belgilangan email manzil bilan kiring.
      </EmptyState>
    </div>
  );
}
