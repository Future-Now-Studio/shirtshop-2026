import { admin, run, assert } from './_clients.mjs';

await run('print_zones', async () => {
  const prod = await admin.from('products').insert({ slug: 'probe-zones', name: 'Zones Tee' }).select().single();

  const ok = await admin.from('print_zones')
    .insert({ product_id: prod.data.id, view: 'front', x: 0.25, y: 0.30, width: 0.5, height: 0.4, label: 'Brust' })
    .select().single();
  assert(!ok.error, 'valid zone inserted');
  assert(ok.data?.label === 'Brust', 'zone label reads back');

  const oob = await admin.from('print_zones')
    .insert({ product_id: prod.data.id, view: 'front', x: 1.5, y: 0.1, width: 0.2, height: 0.2 });
  assert(!!oob.error, 'x outside [0,1] rejected');

  const badView = await admin.from('print_zones')
    .insert({ product_id: prod.data.id, view: 'top', x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
  assert(!!badView.error, 'view outside front/back/left/right rejected');

  await admin.from('products').delete().eq('id', prod.data.id);
});
