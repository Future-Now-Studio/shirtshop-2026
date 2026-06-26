import { admin, run, assert } from './_clients.mjs';

await run('product_sizes + stock matrix', async () => {
  const color = await admin.from('colors').insert({ name: 'SM', hex: '#000000' }).select().single();
  const size = await admin.from('sizes').insert({ name: 'SM-M' }).select().single();
  const prod = await admin.from('products').insert({ slug: 'probe-matrix', name: 'Matrix Tee' }).select().single();
  const variant = await admin.from('variants').insert({ product_id: prod.data.id, color_id: color.data.id }).select().single();

  const ps = await admin.from('product_sizes').insert({ product_id: prod.data.id, size_id: size.data.id });
  assert(!ps.error, 'product_size inserted');
  const psDup = await admin.from('product_sizes').insert({ product_id: prod.data.id, size_id: size.data.id });
  assert(!!psDup.error, 'duplicate (product,size) rejected');

  const av = await admin.from('variant_size_availability')
    .insert({ variant_id: variant.data.id, size_id: size.data.id, stock: 25 }).select().single();
  assert(!av.error, 'availability row inserted');
  assert(av.data?.stock === 25, 'stock count reads back');
  assert(av.data?.available === true, 'available defaults to true');

  await admin.from('products').delete().eq('id', prod.data.id);
  await admin.from('sizes').delete().eq('id', size.data.id);
  await admin.from('colors').delete().eq('id', color.data.id);
});
