// Re-import REAL variant images from WooCommerce, colour-correct per variant.
//
// Two cases:
//  A) variations carry distinct own images (Stella PFM..._C<code>) → use each
//     variation's own colour code.
//  B) all variations share one generic image (B&C/Russell) → WC never linked
//     colours to gallery images, so we pair variation ORDER ↔ the gallery's
//     distinct colour-code order (best effort; extra variations fall back to
//     the generic view).
// Views come from the gallery for that colour code; back/sides fall back to the
// product's generic (code 000) view, then to the front.
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

const EXTRA = ["back", "left", "right"];
const wcProducts = await wc(`/products?per_page=100&status=publish`);
let total = 0;

for (const wp of wcProducts) {
  const dbProd = await admin.from("products").select("id").eq("slug", wp.slug).single();
  if (dbProd.error) { console.warn(`skip ${wp.name}: ${dbProd.error.message}`); continue; }
  const productId = dbProd.data.id;

  // Index gallery
  const byCodeView = {};      // code -> { view: url }
  const genericByView = {};   // view -> url
  const orderedCodes = [];    // distinct non-000 colour codes in first-appearance order
  const seen = new Set();
  for (const img of wp.images || []) {
    const { code, view } = parseFile(fileOf(img.src));
    if (!view) continue;
    if (code) ((byCodeView[code] ||= {})[view] ||= img.src);
    if (code && code !== "000" && !seen.has(code)) { seen.add(code); orderedCodes.push(code); }
    if (view !== "front" && (code === "000" || !genericByView[view])) genericByView[view] = img.src;
  }

  const variations = await wc(`/products/${wp.id}/variations?per_page=100`);
  const varCodes = variations.map((v) => (v.image?.src ? parseFile(fileOf(v.image.src)).code : null));
  const distinct = new Set(varCodes.filter(Boolean));
  const schemeA = distinct.size > 1; // variations have their own distinct images

  // colour name -> resolved code + generic front url
  const resolved = {};
  variations.forEach((v, i) => {
    const name = v.attributes?.find((a) => /farbe|color/i.test(a.name))?.option?.trim();
    if (!name) return;
    const code = schemeA ? varCodes[i] : orderedCodes[i]; // own code, or order-paired
    resolved[name] = { code, genericFront: v.image?.src || null };
  });

  const variants = await admin.from("variants").select("id, colors(name)").eq("product_id", productId);
  if (variants.error) { console.warn(`skip ${wp.name}: ${variants.error.message}`); continue; }

  let imgs = 0;
  for (const variant of variants.data) {
    const info = resolved[variant.colors?.name?.trim()];
    if (!info) continue;
    const cv = info.code ? byCodeView[info.code] || {} : {};

    const frontUrl = cv.front || info.genericFront;
    if (frontUrl && (await uploadFromUrl(productId, variant.id, "front", frontUrl))) imgs++;
    for (const view of EXTRA) {
      const url = cv[view] || genericByView[view];
      if (url && (await uploadFromUrl(productId, variant.id, view, url))) imgs++;
    }
  }
  total += imgs;
  console.log(`✓ ${wp.name}: ${imgs} Bilder / ${variants.data.length} Var. (${schemeA ? "eigene" : "order-paarung"})`);
}

console.log(`\nFertig: ${total} Variant-Bilder.`);
