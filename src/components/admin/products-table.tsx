"use client";

import Link from "next/link";
import { useState } from "react";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { formatMoney } from "@/lib/utils";
import type { Category, Product } from "@/lib/types";

export function ProductsTable({ products, categories, lowStockThreshold }: { products: Product[]; categories: Category[]; lowStockThreshold: number }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [show, setShow] = useState("all");
  const names = new Map(categories.map((c) => [c.id, c.name]));

  const needle = q.trim().toLowerCase();
  const visible = products.filter((p) => {
    if (needle && !`${p.name} ${p.slug}`.toLowerCase().includes(needle)) return false;
    if (category && p.categoryId !== category) return false;
    if (show === "visible" && !p.active) return false;
    if (show === "hidden" && p.active) return false;
    if (show === "low" && p.totalStock > lowStockThreshold) return false;
    return true;
  });

  return (
    <>
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className="sr-only">Mahsulot qidirish</span>
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot qidirish" />
        </label>
        <label>
          <span className="sr-only">Kategoriya</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Barcha kategoriyalar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Koʻrsatish</span>
          <Select value={show} onChange={(e) => setShow(e.target.value)}>
            <option value="all">Barcha mahsulotlar</option>
            <option value="visible">Koʻrinadiganlar</option>
            <option value="hidden">Yashirilganlar</option>
            <option value="low">Kam qolganlar</option>
          </Select>
        </label>
      </div>

      <div className="mt-4">
        {visible.length === 0 ? (
          <EmptyState title={products.length === 0 ? "Hali mahsulot yoʻq" : "Mos mahsulot topilmadi"}>
            {products.length === 0 ? "Doʻkonni ochish uchun birinchi mahsulotni qoʻshing." : "Boshqa soʻz yoki filtr bilan urinib koʻring."}
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {visible.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-brand-50/60 sm:gap-4 sm:px-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images[0]?.url || "/placeholders/product.svg"} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg bg-sand object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted">
                        {(p.categoryId && names.get(p.categoryId)) || "Kategoriyasiz"}
                        {p.variants.length > 0 && ` · ${p.variants.length} ta variant`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {!p.active && <Badge>Yashirilgan</Badge>}
                        {p.featured && <Badge tone="brand">Tavsiya</Badge>}
                        {p.totalStock === 0 ? (
                          <Badge tone="danger">Tugagan</Badge>
                        ) : p.totalStock <= lowStockThreshold ? (
                          <Badge tone="warning">Kam qolgan</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-semibold tabular-nums">{formatMoney(p.salePrice !== null && p.salePrice < p.price ? p.salePrice : p.price)}</p>
                      {p.salePrice !== null && p.salePrice < p.price && <p className="text-xs text-muted tabular-nums line-through">{formatMoney(p.price)}</p>}
                      <p className="text-xs text-muted tabular-nums">Omborda: {p.totalStock} ta</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
