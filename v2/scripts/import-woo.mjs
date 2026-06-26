// One-time WooCommerce → Supabase importer.
// Pulls variable products from the old store and maps them to the v2 schema:
//   product → products (status 'draft' so you review before publishing)
//   "Farbe" variation options → global colors (deduped by name)
//   each variation → one variant + its image uploaded to product-images (front view)
// The source store has no size attribute, so sizes/stock-matrix/print-zones are
// left for you to set in the admin. Re-runnable (idempotent by slug / color name).
import { admin } from "./checks/_clients.mjs";

const WC_BASE = process.env.WC_BASE_URL;
const WC_AUTH = "Basic " + Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString("base64");

if (!WC_BASE || !process.env.WC_CONSUMER_KEY) {
  console.error("Missing WC_BASE_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET in .env");
  process.exit(1);
}

// Best-effort hex for common garment colour names; fallback grey.
const HEX = {
  black: "#111111", white: "#ffffff", grey: "#7f8c8d", gray: "#7f8c8d", "heather grey": "#9aa0a6",
  navy: "#1b2a4a", "french navy": "#1b2540", "oxford navy": "#1b2540", "bottle green": "#0b3d2e",
  "kelly green": "#2e7d32", green: "#2e7d32", red: "#c0392b", "classic red": "#c0392b", "bright royal": "#1e50a2",
  royal: "#1e50a2", "royal blue": "#1e50a2", burgundy: "#5e1322", "sky blue": "#74b9e7", blue: "#2257a5",
  yellow: "#f1c40f", orange: "#e67e22", pink: "#e84393", purple: "#6c3483", "light pink": "#f7b6c8",
  charcoal: "#36454f", sand: "#cdb79e", khaki: "#9b8c5a", brown: "#6b4423", beige: "#d8c3a5",
};
function guessHex(name) {
  const k = String(name).trim().toLowerCase();
  return HEX[k] ?? "#cccccc";
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 2000);
}

async function wc(path) {
  const r = await fetch(`${WC_BASE}${path}`, { headers: { Authorization: WC_AUTH } });
  if (!r.ok) throw new Error(`WC ${path}: ${r.status}`);
  return r.json();
}

// ---- colour cache (global, deduped by name) ----
const colorCache = new Map();
async function ensureColor(name) {
  const key = name.trim();
  if (colorCache.has(key)) return colorCache.get(key);
  const existing = await admin.from("colors").select("id").eq("name", key).limit(1);
  let id = existing.data?.[0]?.id;
  if (!id) {
    const ins = await admin.from("colors").insert({ name: key, hex: guessHex(key) }).select("id").single();
    if (ins.error) throw ins.error;
    id = ins.data.id;
  }
  colorCache.set(key, id);
  return id;
}

async function uploadImage(productId, variantId, srcUrl) {
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ext = (srcUrl.split(".").pop() || "jpg").split("?")[0].toLowerCase().slice(0, 4);
    const path = `${productId}/${variantId}/front.${ext}`;
    const { error } = await admin.storage.from("product-images").upload(path, buf, {
      contentType: res.headers.get("content-type") || "image/jpeg",
      upsert: true,
    });
    if (error) { console.warn("    img upload fail:", error.message); return null; }
    return path;
  } catch (e) {
    console.warn("    img fetch fail:", e.message);
    return null;
  }
}

async function importProduct(wp) {
  const slug = wp.slug;
  const productRow = {
    slug,
    name: wp.name,
    description: stripHtml(wp.description || wp.short_description),
    category: wp.categories?.[0]?.name ?? null,
    base_price: Number(wp.price) || 0,
    status: "draft",
  };
  // upsert by slug
  const up = await admin.from("products").upsert(productRow, { onConflict: "slug" }).select("id").single();
  if (up.error) throw up.error;
  const productId = up.data.id;

  if (wp.type !== "variable") {
    console.log(`  (simple product — no variations) base ${productRow.base_price}€`);
    return;
  }

  const variations = await wc(`/products/${wp.id}/variations?per_page=100`);
  let order = 0;
  for (const v of variations) {
    const colorName = v.attributes?.find((a) => /farbe|color/i.test(a.name))?.option;
    if (!colorName) continue;
    const colorId = await ensureColor(colorName);

    // upsert variant by (product, color)
    const variant = await admin
      .from("variants")
      .upsert({ product_id: productId, color_id: colorId, sort_order: ++order }, { onConflict: "product_id,color_id" })
      .select("id")
      .single();
    if (variant.error) { console.warn("    variant fail:", variant.error.message); continue; }

    if (v.image?.src) {
      const path = await uploadImage(productId, variant.data.id, v.image.src);
      if (path) {
        await admin.from("variant_images").upsert(
          { variant_id: variant.data.id, view: "front", storage_path: path },
          { onConflict: "variant_id,view" }
        );
      }
    }
  }
  console.log(`  ${variations.length} Farb-Varianten importiert`);
}

(async () => {
  const products = await wc(`/products?per_page=100&status=publish`);
  console.log(`WooCommerce: ${products.length} Produkte gefunden\n`);
  let ok = 0;
  for (const wp of products) {
    try {
      console.log(`→ [${wp.id}] ${wp.name}`);
      await importProduct(wp);
      ok++;
    } catch (e) {
      console.error(`  FEHLER: ${e.message}`);
    }
  }
  console.log(`\nFertig: ${ok}/${products.length} Produkte importiert (als Entwurf).`);
})();
