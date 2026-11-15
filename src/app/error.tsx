"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-semibold">Xatolik yuz berdi</h1>
      <p className="mt-3 max-w-md text-muted">
        Sahifani yuklab boʻlmadi. Qayta urinib koʻring — agar buyurtma berayotgan boʻlsangiz, u ikki marta yozilmagan.
      </p>
      <Button className="mt-7" onClick={() => retry()}>
        Qayta urinish
      </Button>
    </main>
  );
}
