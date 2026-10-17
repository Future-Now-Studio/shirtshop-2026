-- Abuse limits for everything anonymous visitors can write.
--  1. order-designs bucket: size + type limits, and anon may only create files
--     under '<uuid>/…' (designer) or 'bulk/<uuid>/…' (bulk inquiry motif).
--  2. Public forms (contact, newsletter, bulk inquiry, review): per-address
--     and global rate limits, so a script can't flood the tables or inboxes.
-- Idempotent.

-- 1. Storage ------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array[
         'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
         'application/pdf', 'application/postscript', 'application/illustrator',
         'application/json', 'application/octet-stream'
       ]
 where id = 'order-designs';

drop policy if exists "anon upload order-designs" on storage.objects;
create policy "anon upload order-designs" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'order-designs'
    and name ~ '^(bulk/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,120}$'
  );

-- 2. Form rate limits ---------------------------------------------------------
-- Generic trigger: TG_ARGV[0] = column identifying the sender (or ''),
-- TG_ARGV[1] = max rows per sender within 10 minutes,
-- TG_ARGV[2] = max rows overall within 1 minute.
create or replace function public.limit_public_inserts()
  returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_col text := tg_argv[0];
  v_per_sender int := tg_argv[1]::int;
  v_global int := tg_argv[2]::int;
  v_sender text;
  v_count int;
begin
  -- the service role (edge functions, admin scripts) is never limited
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  execute format('select count(*) from %I.%I where created_at > now() - interval ''1 minute''',
                 tg_table_schema, tg_table_name) into v_count;
  if v_count >= v_global then
    raise exception 'Zu viele Anfragen – bitte versuche es in einer Minute erneut.'
      using errcode = 'P0001';
  end if;

  if v_col <> '' then
    v_sender := lower(trim(to_jsonb(new) ->> v_col));
    if v_sender is not null and v_sender <> '' then
      execute format('select count(*) from %I.%I where lower(trim(%I::text)) = $1 and created_at > now() - interval ''10 minutes''',
                     tg_table_schema, tg_table_name, v_col)
        into v_count using v_sender;
      if v_count >= v_per_sender then
        raise exception 'Zu viele Anfragen von dieser Adresse – bitte versuche es später erneut.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists limit_contact on public.contact_messages;
create trigger limit_contact before insert on public.contact_messages
  for each row execute function public.limit_public_inserts('email', '3', '20');

drop trigger if exists limit_newsletter on public.newsletter_subscribers;
create trigger limit_newsletter before insert on public.newsletter_subscribers
  for each row execute function public.limit_public_inserts('email', '2', '30');

drop trigger if exists limit_bulk on public.bulk_inquiries;
create trigger limit_bulk before insert on public.bulk_inquiries
  for each row execute function public.limit_public_inserts('email', '3', '20');

drop trigger if exists limit_reviews on public.reviews;
create trigger limit_reviews before insert on public.reviews
  for each row execute function public.limit_public_inserts('name', '3', '20');

-- Length caps so a single insert can't store megabytes of text.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contact_messages_len') then
    alter table public.contact_messages add constraint contact_messages_len
      check (char_length(coalesce(message, '')) <= 5000 and char_length(coalesce(name, '')) <= 200
             and char_length(coalesce(email, '')) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_len') then
    alter table public.reviews add constraint reviews_len
      check (char_length(text) <= 2000 and char_length(name) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bulk_inquiries_len') then
    alter table public.bulk_inquiries add constraint bulk_inquiries_len
      check (char_length(coalesce(bemerkungen, '')) <= 5000 and char_length(email) <= 200) not valid;
  end if;
end $$;
