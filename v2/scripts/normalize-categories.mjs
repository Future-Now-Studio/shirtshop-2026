// Clean up messy imported categories (Uncategorized/Highlight/duplicates).
import { admin } from "./checks/_clients.mjs";

const MAP = {
  uncategorized: null,
  highlight: null,
  hoodie: "Hoodies",
  hoodies: "Hoodies",
  "t-shirt": "T-Shirts",
  shirts: "T-Shirts",
  "baby body": "Baby",
  polohemd: "Polos",
  "schürze": "Accessoires",
};

const { data, error } = await admin.from("products").select("id, category");
if (error) { console.error(error.message); process.exit(1); }

let n = 0;
for (const p of data) {
  if (!p.category) continue;
  const key = p.category.trim().toLowerCase();
  const next = key in MAP ? MAP[key] : p.category.trim();
  if (next !== p.category) {
    await admin.from("products").update({ category: next }).eq("id", p.id);
    n++;
  }
}
console.log(`${n} Kategorien normalisiert.`);
const { data: cats } = await admin.from("products").select("category");
console.log("Kategorien jetzt:", [...new Set(cats.map((c) => c.category).filter(Boolean))].sort().join(", "));
