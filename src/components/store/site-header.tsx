"use client";

import Form from "next/form";
import Link from "next/link";
import { useState } from "react";
import { Menu, Search, Send, ShoppingBag, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cartCount, useCart } from "@/lib/cart";
import type { Category } from "@/lib/types";

function CartLink() {
  const count = cartCount(useCart());
  return (
    <Link
      href="/cart"
      className="relative flex size-11 items-center justify-center rounded-full text-ink hover:bg-sand"
      aria-label={count > 0 ? `Savat, ${count} ta mahsulot` : "Savat"}
    >
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] leading-5 font-bold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function SearchForm({ id, onSubmit }: { id: string; onSubmit?: () => void }) {
  return (
    <Form action="/products" role="search" className="relative w-full" onSubmit={onSubmit}>
      <label htmlFor={id} className="sr-only">
        Mahsulot qidirish
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Mahsulot qidirish"
        autoComplete="off"
        maxLength={80}
        className="min-h-11 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-base placeholder:text-muted/70 hover:border-brand-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-200 focus:outline-none"
      />
    </Form>
  );
}

export function SiteHeader({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const links = [
    { href: "/products", label: "Barcha mahsulotlar" },
    ...categories.slice(0, 5).map((c) => ({ href: `/products?category=${c.slug}`, label: c.name })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Asosiy qismga oʻtish
      </a>
      <div className="container-page flex h-16 items-center gap-2">
        <button
          type="button"
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-sand lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Menyuni yopish" : "Menyuni ochish"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center" aria-label={`${siteConfig.name} — bosh sahifa`} onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={siteConfig.logo.src}
            alt={siteConfig.name}
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav aria-label="Asosiy menyu" className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-ink hover:bg-sand"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden w-64 md:block">
          <SearchForm id="search-desktop" />
        </div>

        <div className="ml-auto flex items-center md:ml-2">
          <a
            href={siteConfig.telegramChannel}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-11 items-center justify-center rounded-full text-brand-700 hover:bg-sand"
            aria-label="Telegram kanalimiz"
            title="Telegram kanalimiz"
          >
            <Send className="size-5" aria-hidden="true" />
          </a>
          <CartLink />
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-cream lg:hidden">
          <div className="container-page space-y-4 py-4">
            <div className="md:hidden">
              <SearchForm id="search-mobile" onSubmit={close} />
            </div>
            <nav aria-label="Mobil menyu" className="grid">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-sand"
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/contact" onClick={close} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-sand">
                Aloqa
              </Link>
              <a
                href={siteConfig.telegramChannel}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-brand-700 hover:bg-sand"
              >
                <Send className="size-4" aria-hidden="true" /> Telegram kanalimiz
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
