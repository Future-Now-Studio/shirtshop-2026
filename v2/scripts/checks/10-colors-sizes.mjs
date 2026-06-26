import { admin, run, assert } from './_clients.mjs';

await run('colors + sizes', async () => {
  const ins = await admin.from('colors').insert({ name: 'Probe', hex: '#123456' }).select().single();
  assert(!ins.error, 'can insert a color');
  assert(ins.data?.hex === '#123456', 'inserted color reads back');

  const s = await admin.from('sizes').insert({ name: 'Probe-M', sort_order: 2 }).select().single();
  assert(!s.error, 'can insert a size');

  // cleanup
  if (ins.data?.id) await admin.from('colors').delete().eq('id', ins.data.id);
  if (s.data?.id)   await admin.from('sizes').delete().eq('id', s.data.id);
});
