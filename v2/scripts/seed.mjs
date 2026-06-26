import { admin } from './checks/_clients.mjs';

function die(label, error) {
  if (error) { console.error(label, error.message); process.exit(1); }
}

// Colors (upsert by name)
const colorRows = [
  { name: 'Schwarz', hex: '#000000', sort_order: 1 },
  { name: 'Weiß',    hex: '#ffffff', sort_order: 2 },
  { name: 'Navy',    hex: '#1b2a4a', sort_order: 3 },
  { name: 'Rot',     hex: '#c0392b', sort_order: 4 },
  { name: 'Grau',    hex: '#7f8c8d', sort_order: 5 },
];
const sizeRows = [
  { name: 'S', sort_order: 1 }, { name: 'M', sort_order: 2 }, { name: 'L', sort_order: 3 },
  { name: 'XL', sort_order: 4 }, { name: 'XXL', sort_order: 5 },
];

const c = await admin.from('colors').upsert(colorRows, { onConflict: 'name' }).select();
die('colors', c.error);
const s = await admin.from('sizes').upsert(sizeRows, { onConflict: 'name' }).select();
die('sizes', s.error);

const colorByName = Object.fromEntries(c.data.map(r => [r.name, r.id]));
const sizeByName  = Object.fromEntries(s.data.map(r => [r.name, r.id]));

const productRows = [
  { slug: 'basic-tee', name: 'Basic Tee', description: 'Klassisches T-Shirt', category: 'shirts', base_price: 19.90, design_element_price: 10.00, status: 'published' },
  { slug: 'hoodie',    name: 'Hoodie',    description: 'Kuscheliger Hoodie',  category: 'hoodies', base_price: 39.90, design_element_price: 10.00, status: 'published' },
];
const p = await admin.from('products').upsert(productRows, { onConflict: 'slug' }).select();
die('products', p.error);
const prodBySlug = Object.fromEntries(p.data.map(r => [r.slug, r.id]));

// Variants: 2 colors per product (upsert by product_id,color_id)
const variantRows = [
  { product_id: prodBySlug['basic-tee'], color_id: colorByName['Schwarz'], sort_order: 1 },
  { product_id: prodBySlug['basic-tee'], color_id: colorByName['Weiß'],    sort_order: 2 },
  { product_id: prodBySlug['hoodie'],    color_id: colorByName['Navy'],    sort_order: 1 },
  { product_id: prodBySlug['hoodie'],    color_id: colorByName['Rot'],     sort_order: 2 },
];
const v = await admin.from('variants').upsert(variantRows, { onConflict: 'product_id,color_id' }).select();
die('variants', v.error);

// product_sizes: both products in S–XL
const sizesForProducts = ['S', 'M', 'L', 'XL'];
const psRows = Object.values(prodBySlug).flatMap(pid =>
  sizesForProducts.map(sz => ({ product_id: pid, size_id: sizeByName[sz] })));
die('product_sizes', (await admin.from('product_sizes').upsert(psRows, { onConflict: 'product_id,size_id' })).error);

// variant_size_availability: every variant in S–XL with stock 50
const avRows = v.data.flatMap(variant =>
  sizesForProducts.map(sz => ({ variant_id: variant.id, size_id: sizeByName[sz], available: true, stock: 50 })));
die('availability', (await admin.from('variant_size_availability').upsert(avRows, { onConflict: 'variant_id,size_id' })).error);

// one print zone on the Basic Tee front (idempotent: delete-then-insert for this product+label)
const teeId = prodBySlug['basic-tee'];
await admin.from('print_zones').delete().eq('product_id', teeId).eq('label', 'Brust groß');
die('print_zones', (await admin.from('print_zones').insert({
  product_id: teeId, view: 'front', x: 0.30, y: 0.28, width: 0.40, height: 0.45, label: 'Brust groß',
})).error);

// volume discounts: reset to two tiers
await admin.from('volume_discounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
die('volume_discounts', (await admin.from('volume_discounts').insert([
  { min_qty: 10, discount_percent: 5.00 },
  { min_qty: 25, discount_percent: 10.00 },
])).error);

// settings email
die('settings', (await admin.from('settings').update({ order_email: 'shop-owner@example.com' }).eq('id', 1)).error);

console.log('Seed complete.');
