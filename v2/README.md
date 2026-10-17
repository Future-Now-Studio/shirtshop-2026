# ShirtShop v2

Custom T-shirt shop. Frontend: Vite + React + Tailwind. Backend: hosted
Supabase (Postgres + Auth + Storage + Edge Functions), payments via Stripe.

## Local development

    npm install
    npm run dev                          # needs v2/.env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY

Full local stack (Docker):

    supabase start                       # applies supabase/migrations
    node scripts/seed.mjs                # demo catalogue (service role from .env)
    node scripts/seed-local-test.mjs     # images, test admin, coupon TEST10 — local only
    supabase functions serve --env-file <file with STRIPE_SECRET_KEY, SITE_URL, …>
    node scripts/checks/<n>.mjs          # backend checks

Secrets live in .env (gitignored): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

## Deploy checklist

1. **Migrations:** `supabase db push` (all files in `supabase/migrations`).
2. **Admin:** `insert into public.admins (user_id) select id from auth.users where email = '…';`
3. **Auth (dashboard):** disable sign-ups; paste the German templates from
   `supabase/templates/` under Authentication → Email Templates (subjects in
   `supabase/config.toml`).
4. **Edge Functions:** `supabase functions deploy` (stripe-webhook without JWT
   check — see config.toml). Secrets: `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ORDER_EMAIL_FROM`,
   `ORDER_EMAIL_TO`, `SITE_URL`.
5. **Stripe:** webhook endpoint `…/functions/v1/stripe-webhook` for
   `payment_intent.succeeded`.
6. **Netlify:** base directory `v2`, env `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` (the build also
   writes `public/sitemap.xml` with all published products).
