import { z } from "zod";
import { siteConfig } from "@/config/site";
import { normalizePhone } from "@/lib/phone";
import { ORDER_STATUSES } from "@/lib/types";

/** Schemas shared by forms (instant feedback) and the server (the real check). */

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(1_000_000_000_000);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .pipe(z.email("Toʻgʻri email manzil kiriting."));

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Telefon raqamingizni kiriting.")
  .max(32)
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: `Toʻgʻri telefon raqam kiriting, masalan: ${siteConfig.phone.example}.`,
      });
      return z.NEVER;
    }
    return normalized;
  });

export const cartLineSchema = z.object({
  productId: id,
  variantId: id.nullable(),
  quantity: z.number().int().min(1).max(siteConfig.order.maxQuantityPerItem),
});
export const cartLinesSchema = z.array(cartLineSchema).min(1).max(siteConfig.order.maxLines);
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  lines: cartLinesSchema,
  name: text(80).min(2, "Ism va familiyangizni kiriting."),
  phone: phoneSchema,
  email: z.union([z.literal(""), emailSchema]),
  areaId: z.string().min(1, "Yetkazib berish hududini tanlang.").max(64).regex(/^[A-Za-z0-9_-]+$/),
  address: text(300).min(5, "Yetkazib berish manzilini kiriting."),
  notes: text(500),
  /** Total the customer saw. The server recomputes and rejects a mismatch. */
  expectedTotal: money,
  /** Honeypot: real customers never fill this in. */
  company: z.string().max(200).optional(),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const profileSchema = z.object({
  name: text(80),
  phone: z.union([z.literal(""), phoneSchema]),
  address: text(300),
  areaId: z.union([z.literal(""), id]),
});

// ───────── Admin ─────────

const variantSchema = z.object({
  id,
  name: text(60).min(1, "Har bir variantga nom bering."),
  stock: z.number().int().min(0).max(1_000_000),
  price: money.nullable(),
  salePrice: money.nullable(),
  swatch: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
});

const imageSchema = z.object({
  url: z.string().min(1).max(1000),
  path: z.string().max(300).nullable(),
  alt: text(160),
});

export const productInputSchema = z
  .object({
    name: text(120).min(2, "Mahsulot nomini kiriting."),
    slug: z.string().trim().max(80),
    description: text(5000),
    categoryId: id.nullable(),
    images: z.array(imageSchema).max(8),
    price: money,
    salePrice: money.nullable(),
    optionLabel: text(30),
    variants: z.array(variantSchema).max(40),
    stock: z.number().int().min(0).max(1_000_000),
    active: z.boolean(),
    featured: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.salePrice !== null && value.salePrice >= value.price) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Chegirma narxi asosiy narxdan past boʻlishi kerak." });
    }
    const names = new Set<string>();
    value.variants.forEach((variant, index) => {
      const key = variant.name.toLowerCase();
      if (names.has(key)) {
        ctx.addIssue({ code: "custom", path: ["variants", index, "name"], message: "Variant nomlari takrorlanmasligi kerak." });
      }
      names.add(key);
      if (variant.salePrice !== null) {
        const base = variant.price ?? value.price;
        if (variant.price === null || variant.salePrice >= base) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", index, "salePrice"],
            message: "Variantning chegirma narxi uchun oʻz (yuqoriroq) narxi boʻlishi kerak.",
          });
        }
      }
    });
    if (value.variants.length > 0 && !value.optionLabel) {
      ctx.addIssue({ code: "custom", path: ["optionLabel"], message: "Variant turini yozing, masalan: Rang yoki Hajm." });
    }
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: text(60).min(2, "Kategoriya nomini kiriting."),
  order: z.number().int().min(0).max(9999),
});

export const settingsInputSchema = z.object({
  deliveryAreas: z
    .array(z.object({ id, name: text(80).min(1, "Har bir hududga nom bering."), fee: money }))
    .min(1, "Kamida bitta yetkazib berish hududini qoʻshing.")
    .max(50),
  freeDeliveryThreshold: money.nullable(),
  lowStockThreshold: z.number().int().min(0).max(100000),
  ownerEmail: z.union([z.literal(""), emailSchema]),
  contact: z.object({
    phone: text(40),
    email: text(120),
    address: text(200),
    hours: text(120),
    instagram: text(200),
    telegram: text(200),
  }),
  announcement: text(160),
  ordersEnabled: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const orderNoteSchema = text(1000).min(1, "Avval izoh yozing.");
export const orderIdSchema = z.uuid();

/** Turn a zod error into { "field.path": "message" } for forms. */
export function fieldErrorsOf(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
