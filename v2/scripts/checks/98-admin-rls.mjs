import { createClient } from '@supabase/supabase-js';
import { admin, anon, run, assert } from './_clients.mjs';

// A signed-in user is NOT an admin unless listed in public.admins.
await run('admin rls', async () => {
  const email = `rls-check-${Date.now()}@example.com`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;

  const order = await admin.from('orders').insert({ customer_email: 'adm@example.com', total: 10 }).select().single();
  const user = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  try {
    const signIn = await user.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    const notAdmin = await user.rpc('is_admin');
    assert(!notAdmin.error && notAdmin.data === false, 'plain user: is_admin() = false');

    const oSeen = await user.from('orders').select('id').eq('id', order.data.id);
    assert(!oSeen.error && oSeen.data.length === 0, 'plain user cannot read orders');

    const hack = await user.from('products').insert({ slug: 'rls-admin-hack', name: 'Hack' });
    assert(!!hack.error, 'plain user cannot insert products');

    const coupons = await user.from('coupons').insert({ code: 'RLSHACK', kind: 'percent', value: 100 });
    assert(!!coupons.error, 'plain user cannot create coupons');

    const place = await user.rpc('place_order', { p_order: {}, p_items: [], p_coupon_id: null });
    assert(!!place.error, 'plain user cannot call place_order');
    const anonPlace = await anon.rpc('place_order', { p_order: {}, p_items: [], p_coupon_id: null });
    assert(!!anonPlace.error, 'anon cannot call place_order');

    await admin.from('admins').insert({ user_id: userId });
    const isAdmin = await user.rpc('is_admin');
    assert(!isAdmin.error && isAdmin.data === true, 'listed user: is_admin() = true');

    const oAdmin = await user.from('orders').select('id').eq('id', order.data.id);
    assert(!oAdmin.error && oAdmin.data.length === 1, 'listed admin reads orders');

    // one order per PaymentIntent
    const pi = `pi_check_${Date.now()}`;
    const a = await admin.from('orders').insert({ total: 1, stripe_payment_intent_id: pi }).select().single();
    const b = await admin.from('orders').insert({ total: 1, stripe_payment_intent_id: pi });
    assert(!a.error && !!b.error, 'stripe_payment_intent_id is unique');
    await admin.from('orders').delete().eq('stripe_payment_intent_id', pi);
  } finally {
    await admin.from('orders').delete().eq('id', order.data.id);
    await admin.from('products').delete().eq('slug', 'rls-admin-hack');
    await admin.from('coupons').delete().eq('code', 'RLSHACK');
    await admin.auth.admin.deleteUser(userId); // cascades public.admins
  }
});
