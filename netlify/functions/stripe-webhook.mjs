// Netlify Function V2 – Stripe webhook (safety net for order creation).
// Set STRIPE_WEBHOOK_SECRET in Netlify env vars and point Stripe at
// https://private-shirt.de/api/stripe-webhook in the dashboard.

import Stripe from 'stripe';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return new Response('Webhook not configured', { status: 500 });
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
  const sig = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    console.log('payment_intent.succeeded:', pi.id, 'metadata:', pi.metadata);
    // Frontend creates the WC order; this log lets ops reconcile if the
    // browser flow dies between payment success and order creation.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/api/stripe-webhook' };
