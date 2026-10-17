-- Newsletter double opt-in (UWG § 7 / DSGVO): a signup only counts once the
-- address confirmed via the emailed link. Existing rows stay unconfirmed —
-- they were collected without confirmation and must not be mailed until they
-- confirm. Idempotent.
alter table public.newsletter_subscribers add column if not exists confirm_token uuid not null default gen_random_uuid();
alter table public.newsletter_subscribers add column if not exists confirmed_at timestamptz;
alter table public.newsletter_subscribers add column if not exists confirmation_sent_at timestamptz;
create unique index if not exists newsletter_subscribers_confirm_token_key
  on public.newsletter_subscribers (confirm_token);

-- Anonymous visitors may only create unconfirmed signups (no self-confirming).
drop policy if exists "anon insert newsletter" on public.newsletter_subscribers;
create policy "anon insert newsletter" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (confirmed_at is null and confirmation_sent_at is null);
