// Set each variant's swatch hex from its OWN front image, so the swatch always
// matches the exact garment shown for that product. Needs the variants.hex
// column (migration 93). Falls back gracefully if a variant has no image.
import sharp from "sharp";
import { admin } from "./checks/_clients.mjs";

function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
async function sample(url) {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const { data } = await sharp(Buffer.from(await r.arrayBuffer())).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let gr = 0, gg = 0, gb = 0, gn = 0, ar = 0, ag = 0, ab = 0, an = 0;
    for (let y = 13; y < 35; y++) for (let x = 13; x < 35; x++) {
      const i = (y * 48 + x) * 3, R = data[i], G = data[i + 1], B = data[i + 2];
      ar += R; ag += G; ab += B; an++;
      if (!(R > 235 && G > 235 && B > 235)) { gr += R; gg += G; gb += B; gn++; }
    }
    return gn > an * 0.12 ? [gr / gn, gg / gn, gb / gn] : [ar / an, ag / an, ab / an];
  } catch { return null; }
}

const variants = await admin
  .from("variants")
  .select("id, variant_images(view, storage_path)");
if (variants.error) { console.error(variants.error.message); process.exit(1); }

let done = 0, skip = 0;
for (const v of variants.data) {
  const f = v.variant_images?.find((i) => i.view === "front") || v.variant_images?.[0];
  if (!f) { skip++; continue; }
  const url = admin.storage.from("product-images").getPublicUrl(f.storage_path).data.publicUrl;
  const c = await sample(url);
  if (!c) { skip++; continue; }
  const { error } = await admin.from("variants").update({ hex: toHex(c[0], c[1], c[2]) }).eq("id", v.id);
  if (!error) { done++; if (done % 50 === 0) console.log(`  …${done}`); }
}
console.log(`Fertig: ${done} Varianten-Hex gesetzt, ${skip} ohne Bild.`);
