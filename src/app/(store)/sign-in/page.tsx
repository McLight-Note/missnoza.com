import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/store/sign-in-form";
import { Card, Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Kirish", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="container-page max-w-md py-10 sm:py-16">
      <h1 className="text-center text-3xl font-semibold sm:text-4xl">Kirish yoki roʻyxatdan oʻtish</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted">
        Google hisobingiz bilan kiring yoki emailingizni kiriting — sizga bir martalik kirish havolasini yuboramiz. Hisob ochish shart emas: roʻyxatdan oʻtmasdan ham buyurtma berishingiz mumkin.
      </p>
      <Card className="mt-6 p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <SignInForm />
        </Suspense>
      </Card>
    </div>
  );
}
