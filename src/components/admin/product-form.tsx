"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2 } from "lucide-react";
import { deleteProductAction, saveProductAction, uploadProductImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea, fieldAria } from "@/components/ui/form";
import { Card } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { resizeImage } from "@/lib/resize-image";
import { moneyToInput, parseMoneyInput } from "@/lib/utils";
import type { Category, Product, ProductImage } from "@/lib/types";

type VariantRow = { id: string; name: string; stock: string; price: string; salePrice: string; swatch: string; useSwatch: boolean };

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

function toRows(product: Product | null): VariantRow[] {
  return (product?.variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    stock: String(v.stock),
    price: moneyToInput(v.price),
    salePrice: moneyToInput(v.salePrice),
    swatch: v.swatch ?? "#c98a7d",
    useSwatch: v.swatch !== null,
  }));
}

const toInt = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

export function ProductForm({ product, categories }: { product: Product | null; categories: Category[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [price, setPrice] = useState(moneyToInput(product?.price));
  const [salePrice, setSalePrice] = useState(moneyToInput(product?.salePrice));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [optionLabel, setOptionLabel] = useState(product?.optionLabel ?? "");
  const [variants, setVariants] = useState<VariantRow[]>(() => toRows(product));
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [active, setActive] = useState(product?.active ?? true);
  const [featured, setFeatured] = useState(product?.featured ?? false);

  const currency = siteConfig.currency.label;
  const hasVariants = variants.length > 0;

  const patchVariant = (id: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).slice(0, Math.max(0, 8 - images.length));
    if (list.length < files.length) setError("Bitta mahsulotga koʻpi bilan 8 ta rasm qoʻshish mumkin.");
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const data = new FormData();
        data.set("file", await resizeImage(file));
        const result = await uploadProductImageAction(data);
        if (result.ok) setImages((current) => [...current, { url: result.data.url, path: result.data.path, alt: "" }]);
        else setError(result.error);
      } catch {
        setError("Rasmni yuklab boʻlmadi. Internet aloqasini tekshirib, qayta urinib koʻring.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const moveImage = (index: number, delta: number) =>
    setImages((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    const priceMinor = parseMoneyInput(price);
    const saleMinor = salePrice.trim() === "" ? null : parseMoneyInput(salePrice);
    const stockInt = toInt(stock);
    if (name.trim().length < 2) found.name = "Mahsulot nomini kiriting.";
    if (priceMinor === null) found.price = "Narxni kiriting, masalan: 120000.";
    if (salePrice.trim() !== "" && saleMinor === null) found.salePrice = "Toʻgʻri chegirma narxini kiriting yoki boʻsh qoldiring.";
    if (priceMinor !== null && saleMinor !== null && saleMinor >= priceMinor) found.salePrice = "Chegirma narxi asosiy narxdan past boʻlishi kerak.";
    if (!hasVariants && stockInt === null) found.stock = "Qoldiqni butun son bilan kiriting.";
    if (hasVariants && !optionLabel.trim()) found.optionLabel = "Variant turini yozing, masalan: Rang yoki Hajm.";

    const parsedVariants = variants.map((row, index) => {
      const rowStock = toInt(row.stock);
      const rowPrice = row.price.trim() === "" ? null : parseMoneyInput(row.price);
      const rowSale = row.salePrice.trim() === "" ? null : parseMoneyInput(row.salePrice);
      if (!row.name.trim()) found[`variants.${index}.name`] = "Har bir variantga nom bering.";
      if (rowStock === null) found[`variants.${index}.stock`] = "Butun son kiriting.";
      if (row.price.trim() !== "" && rowPrice === null) found[`variants.${index}.price`] = "Narx notoʻgʻri.";
      if (row.salePrice.trim() !== "" && rowSale === null) found[`variants.${index}.salePrice`] = "Narx notoʻgʻri.";
      return {
        id: row.id,
        name: row.name.trim(),
        stock: rowStock ?? 0,
        price: rowPrice,
        salePrice: rowSale,
        swatch: row.useSwatch ? row.swatch : null,
      };
    });

    setErrors(found);
    if (Object.keys(found).length > 0 || priceMinor === null) {
      setError("Belgilangan maydonlarni tuzating.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await saveProductAction(
        product?.id ?? null,
        {
          name,
          slug,
          description,
          categoryId: categoryId || null,
          images,
          price: priceMinor,
          salePrice: saleMinor,
          optionLabel,
          variants: parsedVariants,
          stock: hasVariants ? 0 : (stockInt ?? 0),
          active,
          featured,
        },
        product?.updatedAt ?? null,
      ).catch(() => null);
      if (result?.ok) {
        router.replace(`/admin/products/${result.data.id}?saved=${Date.now()}`);
        router.refresh();
      } else {
        setErrors(result?.fieldErrors ?? {});
        setError(result?.error ?? "Server bilan bogʻlanib boʻlmadi. Hech narsa saqlanmadi — qayta urinib koʻring.");
      }
    });
  };

  const onDelete = () => {
    if (!product) return;
    if (!window.confirm(`“${product.name}” oʻchirilsinmi? Bu amalni qaytarib boʻlmaydi. Eski buyurtmalarda uning yozuvi saqlanadi.`)) return;
    startDelete(async () => {
      const result = await deleteProductAction(product.id).catch(() => null);
      if (result?.ok) {
        router.replace("/admin/products");
        router.refresh();
      } else {
        setError(result?.error ?? "Mahsulotni oʻchirib boʻlmadi. Qayta urinib koʻring.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="space-y-6">
        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-sans text-base font-bold">Asosiy maʼlumotlar</h2>
          <Field id="p-name" label="Mahsulot nomi" error={errors.name}>
            <Input {...fieldAria("p-name", errors.name)} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </Field>
          <Field
            id="p-description"
            label="Tavsif"
            hint="Mahsulotni aniq tasvirlang (nima ekani, hajmi, qanday ishlatilishi). Tibbiy yoki natijani kafolatlovchi vaʼdalar yozmang."
            error={errors.description}
          >
            <Textarea
              {...fieldAria("p-description", errors.description, true)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={6}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="p-category" label="Kategoriya" error={errors.categoryId}>
              <Select {...fieldAria("p-category", errors.categoryId)} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Kategoriyasiz</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="p-slug" label="Sahifa manzili" optional hint="Boʻsh qoldirsangiz, nomidan yaratiladi." error={errors.slug}>
              <Input {...fieldAria("p-slug", errors.slug, true)} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} placeholder="rose-lip-tint" />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-base font-bold">Rasmlar</h2>
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} loading={uploading > 0} disabled={images.length >= 8}>
              <ImagePlus className="size-4" aria-hidden="true" /> Rasm yuklash
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-label="Mahsulot rasmlarini yuklash"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </div>
          {images.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              Hali rasm yoʻq. Birinchi rasm doʻkon katalogida koʻrsatiladi.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {images.map((image, index) => (
                <li key={image.url} className="flex gap-3 rounded-xl border border-line p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="size-20 shrink-0 rounded-lg bg-sand object-cover" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="block">
                      <span className="sr-only">{index + 1}-rasm tavsifi (ekran oʻquvchi dasturlar uchun)</span>
                      <Input
                        value={image.alt}
                        onChange={(e) => setImages((cur) => cur.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)))}
                        placeholder="Rasm tavsifi"
                        maxLength={160}
                        className="min-h-9 text-sm"
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      {index === 0 && <span className="mr-auto text-xs font-semibold text-brand-700">Asosiy rasm</span>}
                      <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label="Rasmni oldinga surish" className="ml-auto flex size-9 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30">
                        <ArrowLeft className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} aria-label="Rasmni orqaga surish" className="flex size-9 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setImages((cur) => cur.filter((_, i) => i !== index))} aria-label="Rasmni olib tashlash" className="flex size-9 items-center justify-center rounded-full text-danger hover:bg-danger-soft">
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">JPG, PNG yoki WebP. Rasmlar yuklashdan oldin avtomatik kichraytiriladi (taxminan 1400 px gacha). Olib tashlangan rasmlar saqlaganingizda oʻchiriladi.</p>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-sans text-base font-bold">Narx va qoldiq</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="p-price" label={`Narx (${currency})`} error={errors.price}>
              <Input {...fieldAria("p-price", errors.price)} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </Field>
            <Field id="p-sale" label={`Chegirma narxi (${currency})`} optional error={errors.salePrice}>
              <Input {...fieldAria("p-sale", errors.salePrice)} inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </Field>
            {!hasVariants && (
              <Field id="p-stock" label="Omborda (dona)" error={errors.stock}>
                <Input {...fieldAria("p-stock", errors.stock)} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
              </Field>
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="font-sans text-base font-bold">Hajm yoki ranglar</h2>
            <p className="mt-1 text-sm text-muted">
              Ixtiyoriy. Mahsulot bir necha hajm yoki rangda boʻlsa, variantlar qoʻshing. Har bir variantning oʻz qoldigʻi boʻladi, narxi ham alohida boʻlishi mumkin.
            </p>
          </div>
          {hasVariants && (
            <Field id="p-option" label="Variant turi" hint="Xaridorlarga koʻrsatiladi, masalan: Rang yoki Hajm." error={errors.optionLabel} className="max-w-xs">
              <Input {...fieldAria("p-option", errors.optionLabel, true)} value={optionLabel} onChange={(e) => setOptionLabel(e.target.value)} maxLength={30} placeholder="Rang" />
            </Field>
          )}
          {variants.map((row, index) => {
            const e = (key: string) => errors[`variants.${index}.${key}`];
            return (
              <fieldset key={row.id} className="rounded-xl border border-line p-3">
                <legend className="px-1 text-xs font-semibold text-muted">{index + 1}-variant</legend>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_0.7fr_1fr_1fr]">
                  <Field id={`v-${row.id}-name`} label="Nomi" error={e("name")}>
                    <Input {...fieldAria(`v-${row.id}-name`, e("name"))} value={row.name} onChange={(ev) => patchVariant(row.id, { name: ev.target.value })} maxLength={60} placeholder="Pushti / 30 ml" />
                  </Field>
                  <Field id={`v-${row.id}-stock`} label="Omborda (dona)" error={e("stock")}>
                    <Input {...fieldAria(`v-${row.id}-stock`, e("stock"))} inputMode="numeric" value={row.stock} onChange={(ev) => patchVariant(row.id, { stock: ev.target.value })} />
                  </Field>
                  <Field id={`v-${row.id}-price`} label="Oʻz narxi" optional error={e("price")}>
                    <Input {...fieldAria(`v-${row.id}-price`, e("price"))} inputMode="decimal" value={row.price} onChange={(ev) => patchVariant(row.id, { price: ev.target.value })} placeholder="Umumiy" />
                  </Field>
                  <Field id={`v-${row.id}-sale`} label="Oʻz chegirma narxi" optional error={e("salePrice")}>
                    <Input {...fieldAria(`v-${row.id}-sale`, e("salePrice"))} inputMode="decimal" value={row.salePrice} onChange={(ev) => patchVariant(row.id, { salePrice: ev.target.value })} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="inline-flex min-h-9 items-center gap-2 text-sm">
                    <input type="checkbox" checked={row.useSwatch} onChange={(ev) => patchVariant(row.id, { useSwatch: ev.target.checked })} className="size-4 accent-brand-600" />
                    Rang nuqtasini koʻrsatish
                  </label>
                  {row.useSwatch && (
                    <input type="color" value={row.swatch} onChange={(ev) => patchVariant(row.id, { swatch: ev.target.value })} aria-label={`${row.name || `${index + 1}-variant`} rangi`} className="size-9 rounded-lg border border-line bg-surface p-0.5" />
                  )}
                  <Button variant="dangerGhost" size="sm" className="ml-auto" onClick={() => setVariants((rows) => rows.filter((r) => r.id !== row.id))}>
                    <Trash2 className="size-4" aria-hidden="true" /> Olib tashlash
                  </Button>
                </div>
              </fieldset>
            );
          })}
          <Button
            variant="secondary"
            size="sm"
            disabled={variants.length >= 40}
            onClick={() => setVariants((rows) => [...rows, { id: newId(), name: "", stock: "0", price: "", salePrice: "", swatch: "#c98a7d", useSwatch: false }])}
          >
            <Plus className="size-4" aria-hidden="true" /> Variant qoʻshish
          </Button>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-sans text-base font-bold">Koʻrinishi</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-medium">Doʻkonda koʻrinadi</span>
              <span className="block text-muted">Mahsulotni oʻchirmasdan yashirish uchun belgini olib tashlang.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-medium">Tavsiya etilgan</span>
              <span className="block text-muted">Bosh sahifada birinchi boʻlib koʻrsatiladi.</span>
            </span>
          </label>
        </Card>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={uploading > 0 || deleting}>
          {product ? "Oʻzgarishlarni saqlash" : "Mahsulot yaratish"}
        </Button>
        {product && (
          <Button variant="dangerGhost" className="w-full" onClick={onDelete} loading={deleting} disabled={pending}>
            <Trash2 className="size-4" aria-hidden="true" /> Mahsulotni oʻchirish
          </Button>
        )}
      </div>
    </form>
  );
}
