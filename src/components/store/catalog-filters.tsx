"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import { Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import type { Category } from "@/lib/types";

type Props = {
  categories: Category[];
  sortOptions: readonly { value: string; label: string }[];
  values: { q: string; category: string; sort: string; inStock: boolean; onSale: boolean };
};

/**
 * Search, filter and sort controls. This is a plain GET form, so every
 * combination has its own shareable URL and it works without JavaScript;
 * with JavaScript, changing a control submits straight away.
 */
export function CatalogFilters({ categories, sortOptions, values }: Props) {
  const submit = (event: { currentTarget: { form: HTMLFormElement | null } }) => event.currentTarget.form?.requestSubmit();

  return (
    <Form action="/products" className="grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <label htmlFor="filter-q" className="sr-only">
          Mahsulot qidirish
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="filter-q"
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder="Nomi, kategoriyasi yoki rangi boʻyicha qidiring"
          maxLength={80}
          className="min-h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-base placeholder:text-muted/70 hover:border-brand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="filter-category" className="sr-only">
          Kategoriya
        </label>
        <Select id="filter-category" name="category" defaultValue={values.category} onChange={submit}>
          <option value="">Barcha kategoriyalar</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label htmlFor="filter-sort" className="sr-only">
          Saralash
        </label>
        <Select id="filter-sort" name="sort" defaultValue={values.sort} onChange={submit}>
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              Saralash: {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-1">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="stock" value="1" defaultChecked={values.inStock} onChange={submit} className="size-4 accent-brand-600" />
          Sotuvda bor
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="sale" value="1" defaultChecked={values.onSale} onChange={submit} className="size-4 accent-brand-600" />
          Chegirmada
        </label>
        <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" }, "ml-auto")}>
          Qoʻllash
        </button>
      </div>
    </Form>
  );
}
