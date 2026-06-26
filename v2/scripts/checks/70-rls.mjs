import { admin, anon, run, assert } from './_clients.mjs';

await run('row level security', async () => {
  // seed: one published, one draft product (+ a variant on the published one)
  const color = await admin.from('colors').insert({ name: 'RLS', hex: '#000000' }).select().single();
  const pub = await admin.from('products').insert({ slug: 'rls-pub', name: 'Pub', status: 'published' }).select().single();
  const draft = await admin.from('products').insert({ slug: 'rls-draft', name: 'Draft', status: 'draft' }).select().single();
  const variant = await admin.from('variants').insert({ product_id: pub.data.id, color_id: color.data.id }).select().single();
  const order = await admin.from('orders').insert({ customer_email: 'r@example.com', total: 10 }).select().single();

  // anon sees only the published product among our two probes
  const seen = await anon.from('products').select('id,slug').in('slug', ['rls-pub', 'rls-draft']);
  assert(!seen.error && seen.data.length === 1 && seen.data[0].slug === 'rls-pub',
    'anon sees published product but not draft');

  // anon sees the variant of the published product
  const vSeen = await anon.from('variants').select('id').eq('id', variant.data.id);
  assert(!vSeen.error && vSeen.data.length === 1, 'anon sees variant of published product');

  // anon can read global colors
  const cSeen = await anon.from('colors').select('id').eq('id', color.data.id);
  assert(!cSeen.error && cSeen.data.length === 1, 'anon reads global colors');

  // anon cannot read orders
  const oSeen = await anon.from('orders').select('id').eq('id', order.data.id);
  assert(!oSeen.error && oSeen.data.length === 0, 'anon cannot read orders');

  // anon cannot insert a product (RLS blocks → error)
  const hack = await anon.from('products').insert({ slug: 'rls-hack', name: 'Hack' });
  assert(!!hack.error, 'anon cannot insert products');

  // cleanup
  await admin.from('orders').delete().eq('id', order.data.id);
  await admin.from('products').delete().in('id', [pub.data.id, draft.data.id]);
  await admin.from('colors').delete().eq('id', color.data.id);
});
