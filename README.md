# Private Shirt – shop monorepo

This repository contains three apps:

| Path        | What it is                                                                 |
|-------------|-----------------------------------------------------------------------------|
| `/` (root)  | **Legacy shop** (`privateshirt-legacy`): Vite + React frontend, WooCommerce as catalogue/order backend, Stripe payments, Netlify Functions in `netlify/functions/`, local Express dev API in `server.js`. |
| `v2/`       | **Rebuild** of the shop on Supabase (Postgres, Auth, Storage, Edge Functions). See `v2/README.md`. |
| `ballina/`  | **B2B portal** (Supabase auth/orders, WooCommerce catalogue). See `ballina/README.md` and `ballina/DEPLOY.md`. |

## Legacy shop (root)

```sh
npm install
npm run server   # Express API on http://localhost:3001 (Stripe, WooCommerce orders, contact mail)
npm run dev      # Vite frontend
npm run build    # production build → dist/ (deployed to Netlify together with netlify/functions)
```

Checkout flow: the browser sends the cart to `/api/create-payment-intent`; the server
recomputes the price from WooCommerce product prices (`netlify/functions/_lib/pricing.mjs`)
and creates the Stripe PaymentIntent. After payment, `/api/create-order` re-verifies the
PaymentIntent with Stripe (status, currency, amount, cart fingerprint) and creates the
WooCommerce order once per PaymentIntent. The same code runs in `server.js` (local) and the
Netlify functions (production).

### Environment variables

Set these in `.env` for local development and in the Netlify site settings for production
(never commit values; server-side keys must not get a `VITE_` prefix):

| Variable | Used by | Notes |
|----------|---------|-------|
| `WC_BASE_URL` | server, functions | WooCommerce REST root, e.g. `https://<shop>/wp-json/wc/v3` (required by `server.js`) |
| `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` | server, functions | WooCommerce REST API keys (server-side only) |
| `STRIPE_SECRET_KEY` | server, functions | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | server, `stripe-webhook` | Webhook signing secret; webhooks are rejected without it |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | contact mail | SMTP account for the contact form |
| `CONTACT_EMAIL_TO` | contact mail | Recipient of contact form mails |
| `VITE_STRIPE_PUBLISHABLE_KEY` | frontend | Stripe publishable key (public) |
| `VITE_API_URL` | frontend | Base URL of the API (`http://localhost:3001/api` locally) |

## v2 (Supabase rebuild)

```sh
cd v2
npm install
npm run dev      # or: npm run build
```

Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` (frontend);
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (scripts);
`WC_BASE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET` (server-side catalogue proxy).

## ballina (B2B portal)

```sh
cd ballina
npm install
npm run dev      # or: npm run build
```

Env: see `ballina/.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_MOCK`,
`WC_BASE_URL`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, plus the variables listed in `ballina/DEPLOY.md`).
