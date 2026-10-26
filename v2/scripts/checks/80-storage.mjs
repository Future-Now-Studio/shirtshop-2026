import { admin, anon, run, assert } from './_clients.mjs';

const png = () => new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
const upload = (path, opts = {}) =>
  anon.storage.from('order-designs').upload(path, png(), { contentType: 'image/png', upsert: false, ...opts });

await run('storage buckets', async () => {
  const { data, error } = await admin.storage.listBuckets();
  assert(!error, 'can list buckets');
  const pi = data?.find(b => b.id === 'product-images');
  const dr = data?.find(b => b.id === 'design-renders');
  const od = data?.find(b => b.id === 'order-designs');
  assert(!!pi, 'product-images bucket exists');
  assert(pi?.public === true, 'product-images is public');
  assert(!!dr, 'design-renders bucket exists');
  assert(dr?.public === false, 'design-renders is private');
  assert(!!od, 'order-designs bucket exists');
  assert(od?.public === false, 'order-designs is private');
});

// Anonymous design uploads: create-only, frozen once design.json exists or a
// checkout / order / inquiry references the folder, capped per folder.
await run('order-designs upload rules', async () => {
  const d1 = crypto.randomUUID();
  const d2 = crypto.randomUUID();
  const d3 = crypto.randomUUID();
  const bulk = crypto.randomUUID();
  const created = [];
  let orderId = null;
  const pi = `pi_check_${Date.now()}`;
  try {
    let r = await upload(`${d1}/front-composite.png`);
    assert(!r.error, 'anon uploads into a new design folder');
    if (!r.error) created.push(`${d1}/front-composite.png`);
    r = await upload(`${d1}/front-design.png`);
    assert(!r.error, 'anon adds a second file while the design is fresh');
    if (!r.error) created.push(`${d1}/front-design.png`);

    r = await upload(`${d1}/front-design.png`, { upsert: true });
    assert(!!r.error, 'anon cannot overwrite a design file');
    r = await upload(`not-a-uuid/x.png`);
    assert(!!r.error, 'anon cannot upload outside <uuid>/ folders');
    // a signed upload URL would skip the checks below at upload time
    const signed = await anon.storage.from('order-designs').createSignedUploadUrl(`${d1}/later.png`);
    assert(!!signed.error, 'anon cannot create signed upload URLs');

    const list = await anon.storage.from('order-designs').list(d1);
    assert(!list.error && (list.data?.length ?? 0) === 0, 'anon cannot list design files');
    const dl = await anon.storage.from('order-designs').download(`${d1}/front-design.png`);
    assert(!!dl.error, 'anon cannot download design files');

    // an order references d1 -> no more files from the browser
    const order = await admin.from('orders').insert({ customer_email: 'storage-check@example.com', total: 1 }).select().single();
    if (order.error) throw order.error;
    orderId = order.data.id;
    const item = await admin.from('order_items').insert({ order_id: orderId, qty: 1, unit_price: 1, design_data: { designId: d1 } });
    if (item.error) throw item.error;
    r = await upload(`${d1}/back-composite.png`);
    assert(!!r.error, 'anon cannot add files to an ordered design');
    if (!r.error) created.push(`${d1}/back-composite.png`);

    // a checkout snapshot references d2 -> frozen as well
    r = await upload(`${d2}/front-composite.png`);
    if (!r.error) created.push(`${d2}/front-composite.png`);
    const cart = await admin.from('checkout_carts').insert({ payment_intent_id: pi, items: [{ designId: d2, qty: 1 }], customer: {} });
    if (cart.error) throw cart.error;
    r = await upload(`${d2}/back-composite.png`);
    assert(!!r.error, 'anon cannot add files once checkout started');
    if (!r.error) created.push(`${d2}/back-composite.png`);

    // design.json is the designer's last file -> the design is complete
    r = await upload(`${d3}/front-composite.png`);
    if (!r.error) created.push(`${d3}/front-composite.png`);
    r = await anon.storage.from('order-designs')
      .upload(`${d3}/design.json`, new Blob(['{}'], { type: 'application/json' }), { contentType: 'application/json', upsert: false });
    assert(!r.error, 'anon uploads design.json');
    if (!r.error) created.push(`${d3}/design.json`);
    r = await upload(`${d3}/back-composite.png`);
    assert(!!r.error, 'anon cannot add files after design.json');
    if (!r.error) created.push(`${d3}/back-composite.png`);

    // bulk motif folders hold at most 5 files
    const results = [];
    for (let i = 1; i <= 6; i++) {
      r = await upload(`bulk/${bulk}/motiv-${i}.png`);
      results.push(!r.error);
      if (!r.error) created.push(`bulk/${bulk}/motiv-${i}.png`);
    }
    assert(results.slice(0, 5).every(Boolean) && !results[5], 'bulk motif folder is capped at 5 files');
  } finally {
    if (created.length) await admin.storage.from('order-designs').remove(created);
    if (orderId) await admin.from('orders').delete().eq('id', orderId);
    await admin.from('checkout_carts').delete().eq('payment_intent_id', pi);
  }
});
