// Derive each colour's swatch hex from its ACTUAL front image so the swatch
// always matches the garment shown. Samples the central garment region and
// excludes the near-white background; falls back to the overall average for
// white/very light garments.
import sharp from "sharp";
import { admin } from "./checks/_clients.mjs";

function toHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// One distinct front image path per colour_id (prefer a colour-specific one).
const imgs = await admin
  .from("variant_images")
  .select("storage_path, variants!inner(color_id)")
  .eq("view", "front");
if (imgs.error) { console.error(imgs.error.message); process.exit(1); }

const pathByColor = {};
for (const row of imgs.data) {
  const cid = row.variants.color_id;
  if (!pathByColor[cid]) pathByColor[cid] = row.storage_path;
}

const N = 64; // sample grid
const lo = Math.floor(N * 0.28), hi = Math.floor(N * 0.72); // central garment region

const colors = await admin.from("colors").select("id, name");
let updated = 0, skipped = 0;

for (const c of colors.data) {
  const path = pathByColor[c.id];
  if (!path) { skipped++; continue; }
  try {
    const url = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const res = await fetch(url);
    if (!res.ok) { skipped++; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).resize(N, N, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    let gr = 0, gg = 0, gb = 0, gn = 0; // garment (non-background) sums
    let ar = 0, ag = 0, ab = 0, an = 0; // all-pixels sums (fallback)
    for (let y = lo; y < hi; y++) {
      for (let x = lo; x < hi; x++) {
        const i = (y * N + x) * 3;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        ar += r; ag += g; ab += b; an++;
        const isBg = r > 235 && g > 235 && b > 235; // near-white background
        if (!isBg) { gr += r; gg += g; gb += b; gn++; }
      }
    }
    // If almost everything is background → white/very light garment → use overall avg.
    const hex = gn > an * 0.12 ? toHex(gr / gn, gg / gn, gb / gn) : toHex(ar / an, ag / an, ab / an);
    const up = await admin.from("colors").update({ hex }).eq("id", c.id);
    if (!up.error) { updated++; if (updated % 25 === 0) console.log(`  …${updated}`); }
  } catch {
    skipped++;
  }
}

console.log(`Fertig: ${updated} Farben aus Bild abgeleitet, ${skipped} ohne Bild.`);
