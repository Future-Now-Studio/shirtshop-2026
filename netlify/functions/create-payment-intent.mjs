// Netlify Function V2 – creates a Stripe PaymentIntent server-side.
// Replaces the Express route in server.js for production deployment.

import Stripe from 'stripe';

const ALLOWED_ORIGINS = [
  'https://private-shirt.de',
  'https://www.private-shirt.de',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

  try {
    const { amount, currency = 'eur', items } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers });
    }

    const metadata = {};
    if (Array.isArray(items) && items.length > 0) {
      metadata.item_count = items.length.toString();
      metadata.total_items = items.reduce((s, i) => s + i.quantity, 0).toString();
      const ids = items.map((i) => i.productId).join(',');
      if (ids.length <= 500) metadata.product_ids = ids;
      const names = items.map((i) => `${i.name} (${i.quantity}x)`).join(', ');
      metadata.items = names.length <= 500 ? names : names.substring(0, 497) + '...';
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true, allow_redirects: 'always' },
      metadata,
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error('create-payment-intent error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create payment intent' }),
      { status: 500, headers },
    );
  }
};

export const config = { path: '/api/create-payment-intent' };
