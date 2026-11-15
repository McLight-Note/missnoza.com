import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifySignIn } from "@/components/store/verify-sign-in";
import { Card, Skeleton } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Tizimga kirish", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function VerifyPage() {
  return (
    <div className="container-page max-w-md py-10 sm:py-16">
      <h1 className="text-center text-3xl font-semibold">Tizimga kirish</h1>
      <Card className="mt-6 p-5 sm:p-6">
        <Suspense fallback={<Skeleton className="h-24 w-full" />}>
          <VerifySignIn />
        </Suspense>
      </Card>
    </div>
  );
}
