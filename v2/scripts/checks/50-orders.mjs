import { admin, run, assert } from './_clients.mjs';

await run('orders + order_items', async () => {
  const order = await admin.from('orders')
    .insert({ customer_email: 'k@example.com', total: 59.70 }).select().single();
  assert(!order.error, 'order inserted');

  const bad = await admin.from('order_items')
    .insert({ order_id: order.data.id, qty: 0, unit_price: 19.90 });
  assert(!!bad.error, 'qty must be > 0');

  const item = await admin.from('order_items')
    .insert({ order_id: order.data.id, qty: 3, unit_price: 19.90 }).select().single();
  assert(!item.error, 'order_item inserted');

  // cascade delete
  await admin.from('orders').delete().eq('id', order.data.id);
  const after = await admin.from('order_items').select('id').eq('order_id', order.data.id);
  assert((after.data?.length ?? 0) === 0, 'order_items cascade-deleted with order');
});
