# ShirtShop v2

Rebuild of the custom T-shirt shop. Frontend: Vite + React + shadcn (later phases).
Backend: hosted Supabase (Postgres + Auth + Storage + Edge Functions).

## Backend workflow (no Docker)

    supabase db push            # apply migrations to the hosted project
    node scripts/checks/<n>.mjs # verify a migration against hosted
    node scripts/seed.mjs       # load demo data (service role)
    supabase gen types typescript --linked > src/types/database.ts

Secrets live in .env (gitignored): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
