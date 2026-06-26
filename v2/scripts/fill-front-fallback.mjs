// Fill front-image gaps: any variant without a 'front' image gets the product's
// first available image (its front) as a fallback, so cards/detail/designer
// always show something. Reuses the existing storage path (no re-upload).
import { admin } from "./checks/_clients.mjs";

const products = await admin.from("products").select("id, name");
if (products.error) { console.error(products.error.message); process.exit(1); }

let filled = 0;
for (const p of products.data) {
  const variants = await admin
    .from("variants")
    .select("id, sort_order, variant_images(view, storage_path)")
    .eq("product_id", p.id)
    .order("sort_order");
  if (variants.error) continue;

  // product's first available image (prefer a front, else any view)
  let firstImg = null;
  for (const v of variants.data) {
    const f = v.variant_images?.find((i) => i.view === "front") || v.variant_images?.[0];
    if (f) { firstImg = f.storage_path; break; }
  }
  if (!firstImg) continue; // product has no image at all

  for (const v of variants.data) {
    const hasFront = v.variant_images?.some((i) => i.view === "front");
    if (hasFront) continue;
    const { error } = await admin
      .from("variant_images")
      .upsert({ variant_id: v.id, view: "front", storage_path: firstImg }, { onConflict: "variant_id,view" });
    if (!error) filled++;
  }
}

console.log(`Fertig: ${filled} fehlende Front-Bilder mit Produkt-Erstbild gefüllt.`);
