import { admin, run, assert } from './_clients.mjs';

await run('products + variants + images', async () => {
  const color = await admin.from('colors').insert({ name: 'PV', hex: '#000000' }).select().single();
  assert(!color.error, 'seed color inserted');

  const prod = await admin.from('products')
    .insert({ slug: 'probe-tee', name: 'Probe Tee', base_price: 19.90, status: 'published' })
    .select().single();
  assert(!prod.error, 'product inserted');
  assert(Number(prod.data?.base_price) === 19.9, 'base_price reads back');

  // status check constraint rejects bad values
  const bad = await admin.from('products').insert({ slug: 'probe-bad', name: 'Bad', status: 'archived' }).select().single();
  assert(!!bad.error, 'status outside draft/published rejected');

  const variant = await admin.from('variants')
    .insert({ product_id: prod.data.id, color_id: color.data.id }).select().single();
  assert(!variant.error, 'variant inserted');

  // unique(product_id,color_id)
  const dupVar = await admin.from('variants').insert({ product_id: prod.data.id, color_id: color.data.id });
  assert(!!dupVar.error, 'duplicate (product,color) variant rejected');

  // view check + unique(variant,view)
  const badView = await admin.from('variant_images').insert({ variant_id: variant.data.id, view: 'top', storage_path: 'x.png' });
  assert(!!badView.error, 'view outside front/back/left/right rejected');
  const img1 = await admin.from('variant_images').insert({ variant_id: variant.data.id, view: 'front', storage_path: 'f.png' });
  assert(!img1.error, 'first front image inserted');
  const img2 = await admin.from('variant_images').insert({ variant_id: variant.data.id, view: 'front', storage_path: 'f2.png' });
  assert(!!img2.error, 'second front image for same variant rejected');

  // cleanup (cascade from product removes variants + images)
  await admin.from('products').delete().eq('id', prod.data.id);
  await admin.from('colors').delete().eq('id', color.data.id);
});
