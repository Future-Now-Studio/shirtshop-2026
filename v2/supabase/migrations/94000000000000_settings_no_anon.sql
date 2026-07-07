-- Harden: the frontend never reads `settings`; only the Edge Functions
-- (service_role, bypasses RLS) and the admin (authenticated) need it. The
-- anon read policy only exposed order_email. Drop it.
drop policy if exists "anon read settings" on public.settings;
