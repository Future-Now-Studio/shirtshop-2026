// Re-import REAL variant images from WooCommerce, all available views per colour.
// Two filename schemes exist in the store:
//   A (Stanley/Stella):  PFM0_<style>_C<code>.jpg   F=front B=back, code is colour
//   B (B&C/Russell):     <style>_<n>_<code>_<view>-<year>_NN.jpg  view∈F/B/SR/SL
// In scheme B only the FRONT is colour-specific; back/sides are a generic garment
// outline (code 000) shared by all colours.
// Strategy per variant: front = the variation's own image (always colour-correct);
// back/left/right = colour-specific from the gallery if present, else the generic view.
import { admin } from "./checks/_clients.mjs";

const WC_BASE = process.env.WC_BASE_URL;
const WC_AUTH = "Basic " + Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString("base64");

async function wc(path) {
  const r = await fetch(`${WC_BASE}${path}`, { headers: { Authorization: WC_AUTH } });
  if (!r.ok) throw new Error(`WC ${path}: ${r.status}`);
  return r.json();
}

function mapView(x) {
  x = (x || "").toUpperCase();
  if (x === "F") return "front";
  if (x === "B") return "back";
  if (x === "SR" || x === "R") return "right";
  if (x === "SL" || x === "L" || x === "S") return "left";
  return null;
}
function parseFile(file) {
  if (!file) return { code: null, view: null };
  let m = file.match(/^P([FBSLR])M\d*_/i);
  if (m) return { view: mapView(m[1]), code: (file.match(/_C(\w+?)(?:[-_.]|$)/) || [])[1] || null };
  m = file.match(/^\w+?_\w+?_(\w+?)_([A-Za-z]{1,2})[-_.]/);
  if (m) return { code: m[1], view: mapView(m[2]) };
  return { code: null, view: null };
}
const fileOf = (url) => url.split("/").pop();

async function uploadFromUrl(productId, variantId, view, srcUrl) {
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return false;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ext = (srcUrl.split(".").pop() || "jpg").split("?")[0].toLowerCase().slice(0, 4);
    const path = `${productId}/${variantId}/${view}.${ext}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, buf, {
      contentType: res.headers.get("content-type") || "image/jpeg",
      upsert: true,
    });
    if (upErr) return false;
    const { error } = await admin
      .from("variant_images")
      .upsert({ variant_id: variantId, view, storage_path: path }, { onConflict: "variant_id,view" });
    return !error;
  } catch {
    return false;
  }
}

const EXTRA_VIEWS = ["back", "left", "right"];
const wcProducts = await wc(`/products?per_page=100&status=publish`);
let total = 0;

for (const wp of wcProducts) {
  const dbProd = await admin.from("products").select("id").eq("slug", wp.slug).single();
  if (dbProd.error) { console.warn(`skip ${wp.name}: ${dbProd.error.message}`); continue; }
  const productId = dbProd.data.id;

  // Index gallery: by code+view, and a generic view fallback.
  const byCodeView = {};        // code -> { view: url }
  const genericByView = {};     // view -> url (prefer code 000 / first seen)
  for (const img of wp.images || []) {
    const { code, view } = parseFile(fileOf(img.src));
    if (!view) continue;
    if (code) ((byCodeView[code] ||= {})[view] ||= img.src);
    if (view !== "front" && (code === "000" || !genericByView[view])) genericByView[view] = img.src;
  }

  // variation: colour name -> { code, frontUrl }
  const variations = await wc(`/products/${wp.id}/variations?per_page=100`);
  const infoByColor = {};
  for (const v of variations) {
    const colorName = v.attributes?.find((a) => /farbe|color/i.test(a.name))?.option?.trim();
    if (!colorName) continue;
    const code = v.image?.src ? parseFile(fileOf(v.image.src)).code : null;
    infoByColor[colorName] = { code, frontUrl: v.image?.src || null };
  }

  const variants = await admin.from("variants").select("id, colors(name)").eq("product_id", productId);
  if (variants.error) { console.warn(`skip ${wp.name}: ${variants.error.message}`); continue; }

  let imgs = 0;
  for (const variant of variants.data) {
    const colorName = variant.colors?.name?.trim();
    const info = infoByColor[colorName];
    if (!info) continue;

    if (info.frontUrl && (await uploadFromUrl(productId, variant.id, "front", info.frontUrl))) imgs++;

    const colorViews = info.code ? byCodeView[info.code] || {} : {};
    for (const view of EXTRA_VIEWS) {
      const url = colorViews[view] || genericByView[view];
      if (url && (await uploadFromUrl(productId, variant.id, view, url))) imgs++;
    }
  }
  total += imgs;
  console.log(`✓ ${wp.name}: ${imgs} Bilder / ${variants.data.length} Varianten`);
}

console.log(`\nFertig: ${total} Variant-Bilder importiert.`);
