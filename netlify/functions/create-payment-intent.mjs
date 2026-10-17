// Netlify Function V2 – creates a Stripe PaymentIntent server-side.
// The amount is recomputed from WooCommerce prices (see _lib/pricing.mjs);
// any amount sent by the browser is ignored.

import Stripe from 'stripe';
import { getWcConfig } from './_lib/pricing.mjs';
import { createPaymentIntentForCart } from './_lib/checkout.mjs';

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
    'Cache-Control': 'no-store',
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

  const wc = getWcConfig();
  if (!process.env.STRIPE_SECRET_KEY || !wc) {
    return new Response(JSON.stringify({ error: 'Checkout not configured' }), { status: 500, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  const result = await createPaymentIntentForCart({ stripe, wc, items: body?.items });
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
};

export const config = { path: '/api/create-payment-intent' };
