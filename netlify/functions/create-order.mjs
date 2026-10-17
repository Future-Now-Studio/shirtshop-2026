// Netlify Function V2 – creates a WooCommerce order after a verified Stripe payment.
// The PaymentIntent is retrieved from Stripe (must be succeeded, EUR, created for this
// cart, amount == server-computed total) and the order is created at most once per
// PaymentIntent. Client prices/totals are ignored – see _lib/checkout.mjs.

import Stripe from 'stripe';
import { getWcConfig } from './_lib/pricing.mjs';
import { createOrderFromPayment } from './_lib/checkout.mjs';

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

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  const wc = getWcConfig();
  if (!wc || !process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Checkout not configured' }), { status: 500, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  const result = await createOrderFromPayment({ stripe, wc, body });
  return new Response(JSON.stringify(result.body), { status: result.status, headers });
};

export const config = { path: '/api/create-order' };
