// Fill an EMPTY shop with sample categories, products and default settings so
// you can see how everything looks. All of it is placeholder content: edit or
// delete it in the admin area.
//
//   npm run seed            (does nothing if products already exist)
//   npm run seed -- --force (adds or resets the samples even if products exist)
import { FieldValue } from "firebase-admin/firestore";
import { db, target } from "./_firebase.mjs";

const force = process.argv.includes("--force");
console.log(`Target: ${target}`);

const existing = await db.collection("products").limit(1).get();
if (!existing.empty && !force) {
  console.log("Products already exist — nothing was changed. Use --force to add or reset the samples anyway.");
  process.exit(0);
}

const image = (name, alt) => [{ url: `/placeholders/${name}.svg`, path: null, alt }];
const SAMPLE = "Namuna matn — oʻrniga oʻz tavsifingizni yozing: mahsulot nima ekani, hajmi va qanday ishlatilishi.";

const categories = [
  { id: "skincare", name: "Teri parvarishi", order: 10 },
  { id: "makeup", name: "Makiyaj", order: 20 },
  { id: "lips", name: "Lablar uchun", order: 30 },
  { id: "body", name: "Tana va atirlar", order: 40 },
];

// Prices are in the smallest unit of the currency set in src/config/site.ts.
const products = [
  { name: "Namlovchi yuz zardobi", categoryId: "skincare", img: "serum", price: 185000, salePrice: 159000, featured: true, optionLabel: "Hajm", variants: [{ name: "30 ml", stock: 18 }, { name: "50 ml", stock: 9, price: 265000 }] },
  { name: "Kundalik namlovchi krem", categoryId: "skincare", img: "cream", price: 149000, featured: true, stock: 24 },
  { name: "Yumshoq tozalovchi koʻpik", categoryId: "skincare", img: "cleanser", price: 98000, stock: 30 },
  { name: "Mat lab boʻyogʻi", categoryId: "lips", img: "lipstick", price: 89000, featured: true, optionLabel: "Rang", variants: [{ name: "Och pushti", stock: 12, swatch: "#c98a7d" }, { name: "Toʻq qizil", stock: 7, swatch: "#8a2749" }, { name: "Klassik qizil", stock: 0, swatch: "#b3261e" }] },
  { name: "Rangli lab balzami", categoryId: "lips", img: "lipstick", price: 59000, salePrice: 49000, optionLabel: "Rang", variants: [{ name: "Shaftoli", stock: 15, swatch: "#f0a58a" }, { name: "Pushti", stock: 4, swatch: "#e58aa6" }] },
  { name: "Koʻz soyalari palitrasi — iliq ranglar", categoryId: "makeup", img: "palette", price: 215000, featured: true, stock: 6 },
  { name: "Tetiklashtiruvchi yuz spreyi", categoryId: "skincare", img: "mist", price: 79000, stock: 3 },
  { name: "Tana spreyi — mayin gul ifori", categoryId: "body", img: "mist", price: 119000, stock: 14 },
];

const batch = db.batch();
for (const c of categories) {
  batch.set(db.collection("categories").doc(c.id), { name: c.name, slug: c.id, order: c.order }, { merge: true });
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[\u02bb\u02bc'’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
let offset = 0;
for (const p of products) {
  const variants = (p.variants ?? []).map((v) => ({
    id: slugify(v.name),
    name: v.name,
    stock: v.stock,
    price: v.price ?? null,
    salePrice: null,
    swatch: v.swatch ?? null,
  }));
  const stock = variants.length > 0 ? 0 : (p.stock ?? 0);
  const now = Date.now() - offset++ * 60_000;
  // Fixed IDs make the script safe to run twice: it resets the samples
  // instead of adding duplicates.
  batch.set(db.collection("products").doc(`sample-${slugify(p.name)}`), {
    name: p.name,
    slug: slugify(p.name),
    description: SAMPLE,
    categoryId: p.categoryId,
    images: image(p.img, `${p.name} (namuna rasm)`),
    price: p.price,
    salePrice: p.salePrice ?? null,
    optionLabel: p.optionLabel ?? "",
    variants,
    stock,
    totalStock: variants.length > 0 ? variants.reduce((n, v) => n + v.stock, 0) : stock,
    active: true,
    featured: p.featured === true,
    createdAt: new Date(now),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
await batch.commit();
console.log(`Added ${categories.length} categories and ${products.length} sample products.`);
console.log("Open the shop to see them (the catalogue refreshes within a few minutes, or straight away after any admin save).");
process.exit(0);
