// Makes imported draft products shop-ready: assigns a standard size run (S–XXL)
// and a default availability/stock for every color variant, so they only need a
// final review + "publish" in the admin. Idempotent. Leaves status = draft.
import { admin } from "./checks/_clients.mjs";

const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];
const DEFAULT_STOCK = 20;

const sizes = await admin.from("sizes").select("id, name");
if (sizes.error) { console.error(sizes.error.message); process.exit(1); }
const sizeIdByName = Object.fromEntries(sizes.data.map((s) => [s.name, s.id]));
const sizeIds = DEFAULT_SIZES.map((n) => sizeIdByName[n]).filter(Boolean);
if (sizeIds.length === 0) { console.error("No S–XXL sizes found — seed sizes first."); process.exit(1); }

const products = await admin.from("products").select("id, name, status").eq("status", "draft");
if (products.error) { console.error(products.error.message); process.exit(1); }
console.log(`${products.data.length} Entwurf-Produkte\n`);

for (const p of products.data) {
  // product_sizes
  const psRows = sizeIds.map((size_id) => ({ product_id: p.id, size_id }));
  const ps = await admin.from("product_sizes").upsert(psRows, { onConflict: "product_id,size_id" });
  if (ps.error) { console.warn(`  ${p.name}: product_sizes`, ps.error.message); continue; }

  // variant_size_availability for each variant × size
  const variants = await admin.from("variants").select("id").eq("product_id", p.id);
  if (variants.error) { console.warn(`  ${p.name}: variants`, variants.error.message); continue; }

  const avRows = variants.data.flatMap((v) =>
    sizeIds.map((size_id) => ({ variant_id: v.id, size_id, available: true, stock: DEFAULT_STOCK }))
  );
  if (avRows.length) {
    const av = await admin.from("variant_size_availability").upsert(avRows, { onConflict: "variant_id,size_id" });
    if (av.error) { console.warn(`  ${p.name}: availability`, av.error.message); continue; }
  }
  console.log(`✓ ${p.name} — ${variants.data.length} Varianten × ${sizeIds.length} Größen`);
}

console.log("\nFertig. Produkte sind shop-ready (noch als Entwurf — im Admin prüfen + veröffentlichen).");
