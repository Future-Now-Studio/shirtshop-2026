-- Owner notification for public form submissions (contact, bulk inquiry,
-- review): the notify-admin Edge Function mails the owner once per row and
-- stamps notified_at. Anonymous inserts can never set it (see the
-- public-write hardening trigger).
alter table public.contact_messages add column if not exists notified_at timestamptz;
alter table public.bulk_inquiries   add column if not exists notified_at timestamptz;
alter table public.reviews          add column if not exists notified_at timestamptz;
