// Extra seed for a LOCAL Supabase stack (supabase start): product images,
// a test admin and a test coupon, so every shop/admin flow can be clicked
// through. Run after scripts/seed.mjs. Never run against production.
//
//   node scripts/seed-local-test.mjs
//
// Test admin login (local only): admin@shirtshop.test / local-test-admin-123
import { readFile } from 'node:fs/promises';
import { admin } from './checks/_clients.mjs';

if (!/127\.0\.0\.1|localhost/.test(process.env.SUPABASE_URL ?? '')) {
  throw new Error('seed-local-test.mjs only runs against a local Supabase (SUPABASE_URL=127.0.0.1)');
}

const ADMIN_EMAIL = 'admin@shirtshop.test';
const ADMIN_PASSWORD = 'local-test-admin-123';

const die = (label, error) => { if (error) { console.error(label, error.message); process.exit(1); } };

// Front images per colour (the repo's mockups / product photos).
const imageByColor = {
  Schwarz: ['scripts/fixtures/tshirt-mockup-black.png', 'image/png'],
  'Weiß': ['scripts/fixtures/tshirt-mockup-white.png', 'image/png'],
  Navy: ['scripts/fixtures/product-hoodie.jpg', 'image/jpeg'],
  Rot: ['scripts/fixtures/product-hoodie.jpg', 'image/jpeg'],
};

const { data: variants, error: vErr } = await admin.from('variants').select('id, product_id, colors(name)');
die('variants', vErr);
for (const v of variants) {
  const img = imageByColor[v.colors?.name];
  if (!img) continue;
  const [file, type] = img;
  const ext = file.split('.').pop();
  for (const view of ['front', 'back']) {
    const path = `${v.product_id}/${v.id}/${view}.${ext}`;
    const up = await admin.storage.from('product-images').upload(path, await readFile(file), { contentType: type, upsert: true });
    die(`upload ${path}`, up.error);
    die('variant_images', (await admin.from('variant_images').upsert(
      { variant_id: v.id, view, storage_path: path }, { onConflict: 'variant_id,view' })).error);
  }
}

// Test admin (signup is disabled, so create via the admin API).
const { data: list } = await admin.auth.admin.listUsers();
let user = list.users.find((u) => u.email === ADMIN_EMAIL);
if (!user) {
  const created = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true });
  die('admin user', created.error);
  user = created.data.user;
}
die('admins', (await admin.from('admins').upsert({ user_id: user.id })).error);

// Test coupon: 10 % off, max 3 uses.
die('coupon', (await admin.from('coupons').upsert(
  { code: 'TEST10', kind: 'percent', value: 10, max_uses: 3, active: true }, { onConflict: 'code' })).error);

console.log('Local test seed complete.');
