import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Sahifa topilmadi</p>
      <h1 className="mt-2 text-4xl font-semibold">Bunday sahifa topilmadi</h1>
      <p className="mt-3 max-w-md text-muted">Havola eskirgan yoki mahsulot endi sotuvda yoʻq boʻlishi mumkin.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/products" className={buttonClass()}>
          Mahsulotlarni koʻrish
        </Link>
        <Link href="/" className={buttonClass({ variant: "secondary" })}>
          Bosh sahifaga oʻtish
        </Link>
      </div>
    </main>
  );
}
