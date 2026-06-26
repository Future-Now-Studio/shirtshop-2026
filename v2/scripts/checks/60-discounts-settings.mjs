import { admin, run, assert } from './_clients.mjs';

await run('volume_discounts + settings', async () => {
  const vd = await admin.from('volume_discounts').insert({ min_qty: 10, discount_percent: 5 }).select().single();
  assert(!vd.error, 'volume discount inserted');
  await admin.from('volume_discounts').delete().eq('id', vd.data.id);

  const s = await admin.from('settings').select('*');
  assert(!s.error && s.data?.length === 1, 'settings has exactly one seeded row');

  const badId = await admin.from('settings').insert({ id: 2 });
  assert(!!badId.error, 'settings rejects id other than 1');
});
