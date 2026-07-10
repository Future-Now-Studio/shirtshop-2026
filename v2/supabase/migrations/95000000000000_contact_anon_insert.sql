-- Re-assert anon insert policies for the contact + newsletter tables. The
-- public contact form and the Großbestellung inquiry form both insert as anon;
-- without these policies the insert fails with an RLS violation. Idempotent.
alter table public.contact_messages       enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "anon insert contact" on public.contact_messages;
create policy "anon insert contact" on public.contact_messages
  for insert to anon with check (true);

drop policy if exists "anon insert newsletter" on public.newsletter_subscribers;
create policy "anon insert newsletter" on public.newsletter_subscribers
  for insert to anon with check (true);
