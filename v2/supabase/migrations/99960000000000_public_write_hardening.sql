-- Public write hardening: everything anonymous visitors can write. Idempotent.
--  1. Trusted writers: the service role (Edge Functions, admin scripts) and
--     direct database sessions (migrations, SQL editor). Read from the JSON
--     claims GUC — the legacy request.jwt.claim.role is no longer set, so the
--     old rate-limit bypass for the service role never fired.
--  2. Public form inserts (contact, bulk inquiry, review, newsletter): the
--     server sets created_at and every admin-only column. A backdated
--     created_at no longer slips past the rate limits, nobody can submit a
--     row that is already "handled" / "approved" / "confirmed", and the
--     newsletter confirm token is always generated server-side (no forged
--     double opt-in). The client-generated id is kept (forms pass it on to
--     the notify-admin function).
--  3. Newsletter addresses: stored lower-case, unique case-insensitively.
--  4. order-designs uploads: a design folder is frozen as soon as its
--     design.json exists or a checkout, order or bulk inquiry references it;
--     no signed upload URLs; per-folder caps; a global budget for all
--     anonymous uploads.
--  5. Orphan listing for the cleanup-designs Edge Function.

-- 1. Trusted writers ---------------------------------------------------------
create or replace function public.is_trusted_writer()
  returns boolean
  language sql stable set search_path = public, pg_temp as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is not null
      then (current_setting('request.jwt.claims', true)::jsonb ->> 'role') is not distinct from 'service_role'
    -- no API request at all: a direct database session
    else session_user not in ('authenticator', 'anon', 'authenticated')
  end;
$$;
revoke all on function public.is_trusted_writer() from public, anon, authenticated;

-- 2. Public form inserts -----------------------------------------------------
-- Fires before the limit_* rate-limit triggers (same-timing triggers run in
-- name order), so those always see the normalised row.
create or replace function public.harden_public_insert()
  returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'newsletter_subscribers' then
    new.email := lower(trim(new.email));
  end if;
  if public.is_trusted_writer() then
    return new;
  end if;

  new.created_at := now();
  if tg_table_name = 'contact_messages' then
    new.handled := false;
    new.notified_at := null;
  elsif tg_table_name = 'bulk_inquiries' then
    new.status := 'neu';
    new.notified_at := null;
  elsif tg_table_name = 'reviews' then
    new.approved := false;
    new.notified_at := null;
  elsif tg_table_name = 'newsletter_subscribers' then
    new.confirm_token := gen_random_uuid();
    new.confirmed_at := null;
    new.confirmation_sent_at := null;
  end if;
  return new;
end $$;
revoke all on function public.harden_public_insert() from public, anon, authenticated;

drop trigger if exists harden_contact on public.contact_messages;
create trigger harden_contact before insert on public.contact_messages
  for each row execute function public.harden_public_insert();

drop trigger if exists harden_bulk on public.bulk_inquiries;
create trigger harden_bulk before insert on public.bulk_inquiries
  for each row execute function public.harden_public_insert();

drop trigger if exists harden_reviews on public.reviews;
create trigger harden_reviews before insert on public.reviews
  for each row execute function public.harden_public_insert();

drop trigger if exists harden_newsletter on public.newsletter_subscribers;
create trigger harden_newsletter before insert on public.newsletter_subscribers
  for each row execute function public.harden_public_insert();

-- Rate limits (same limits as before, see 99700): only the trusted-writer
-- check changes.
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
  if public.is_trusted_writer() then
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

-- 3. Newsletter addresses ----------------------------------------------------
-- Merge existing case / whitespace variants of one address: keep the
-- confirmed row (earliest confirmation = consent proof), else the one with
-- the latest confirmation mail, else the oldest signup.
delete from public.newsletter_subscribers n
 using (
   select id, row_number() over (
            partition by lower(trim(email))
            order by confirmed_at asc nulls last, confirmation_sent_at desc nulls last, created_at, id
          ) as rn
     from public.newsletter_subscribers
 ) d
 where n.id = d.id and d.rn > 1;

update public.newsletter_subscribers set email = lower(trim(email))
 where email <> lower(trim(email));

create unique index if not exists newsletter_subscribers_email_lower_key
  on public.newsletter_subscribers (lower(email));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'newsletter_email_normalized') then
    alter table public.newsletter_subscribers add constraint newsletter_email_normalized
      check (email = lower(trim(email)));
  end if;
  -- not valid: old junk rows stay until the admin deletes them
  if not exists (select 1 from pg_constraint where conname = 'newsletter_email_format') then
    alter table public.newsletter_subscribers add constraint newsletter_email_format
      check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') not valid;
  end if;
end $$;

-- A confirmation without any confirmation mail can only come from the forged
-- token hole closed above (the link exists only in that mail): no consent.
-- Imported, already-confirmed subscribers must carry confirmation_sent_at.
update public.newsletter_subscribers set confirmed_at = null
 where confirmed_at is not null and confirmation_sent_at is null;

-- 4. order-designs uploads ---------------------------------------------------
-- Upload budget for the whole bucket per 10-minute window. Counted by an
-- AFTER INSERT trigger on storage.objects: the Storage API checks the insert
-- policy in a rolled-back test transaction and writes the row itself, so the
-- policy can read this table but never count into it.
create table if not exists public.design_upload_windows (
  window_start  timestamptz primary key,
  files         integer not null default 0,
  bytes         bigint  not null default 0
);
-- internal: no policies, only the functions below and the service role
alter table public.design_upload_windows enable row level security;
revoke all on public.design_upload_windows from anon, authenticated;

create or replace function public.track_design_upload()
  returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.design_upload_windows as w (window_start, files, bytes)
  values (date_bin('10 minutes', now(), timestamptz '2000-01-01'), 1,
          case when new.metadata ->> 'size' ~ '^\d{1,15}$' then (new.metadata ->> 'size')::bigint else 0 end)
  on conflict (window_start) do update
    set files = w.files + 1, bytes = w.bytes + excluded.bytes;
  return null;
exception when others then
  -- bookkeeping must never fail an upload
  raise warning 'track_design_upload: %', sqlerrm;
  return null;
end $$;
revoke all on function public.track_design_upload() from public, anon, authenticated;

do $$
begin
  drop trigger if exists track_design_upload on storage.objects;
  create trigger track_design_upload after insert on storage.objects
    for each row when (new.bucket_id = 'order-designs')
    execute function public.track_design_upload();
exception when insufficient_privilege then
  -- don't block the rollout; the per-folder limits still apply
  raise warning 'track_design_upload not created (%): global upload budget inactive', sqlerrm;
end $$;

-- Insert check for anonymous design / motif uploads. Paths:
-- '<designId>/<file>' (designer) and 'bulk/<uuid>/<file>' (bulk inquiry motif).
create or replace function public.can_upload_order_design(p_bucket text, p_name text, p_metadata jsonb)
  returns boolean
  language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  c_open_for     constant interval := interval '24 hours'; -- folder accepts files this long after its first one
  c_window_files constant integer  := 1500;                -- all uploads per 10 minutes
  c_window_bytes constant bigint   := 1536::bigint * 1024 * 1024;
  v_bulk   boolean := p_name like 'bulk/%';
  v_id     text;
  v_folder text;
  v_size   bigint;
  v_files  integer;
  v_bytes  bigint;
  v_first  timestamptz;
begin
  if p_bucket is distinct from 'order-designs'
     or p_name !~ '^(bulk/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]{1,120}$' then
    return false;
  end if;
  -- No signed upload URLs: the Storage API checks this policy only when
  -- signing and runs the later upload as superuser, so a URL signed before
  -- checkout would still write into the frozen folder (and skip the caps)
  -- for two hours. The designer and the bulk form upload directly.
  if current_setting('storage.operation', true) = 'storage.object.sign_upload_url' then
    return false;
  end if;
  v_id := case when v_bulk then split_part(p_name, '/', 2) else split_part(p_name, '/', 1) end;
  v_folder := case when v_bulk then 'bulk/' || v_id else v_id end;
  -- declared length before the upload, real size afterwards
  v_size := case when coalesce(p_metadata ->> 'size', p_metadata ->> 'contentLength') ~ '^\d{1,15}$'
                 then coalesce(p_metadata ->> 'size', p_metadata ->> 'contentLength')::bigint else 0 end;

  -- Frozen once complete or referenced: design.json is the designer's last
  -- file (added to the cart right after), then checkout (cart snapshot),
  -- order, bulk inquiry. Afterwards only the service role may add files.
  if v_bulk then
    if exists (select 1 from public.bulk_inquiries where motiv_path like v_folder || '/%') then
      return false;
    end if;
  elsif exists (select 1 from storage.objects
                 where bucket_id = 'order-designs' and name collate "C" = v_folder || '/design.json')
     or exists (select 1 from public.order_items where design_data ->> 'designId' = v_id)
     or exists (select 1 from public.checkout_carts
                 where items @> jsonb_build_array(jsonb_build_object('designId', v_id))) then
    return false;
  end if;

  -- Per folder: file count, total size, upload window. Range on the
  -- C-collated (bucket_id, name) index = "name starts with '<folder>/'".
  select count(*),
         coalesce(sum(case when metadata ->> 'size' ~ '^\d{1,15}$' then (metadata ->> 'size')::bigint else 0 end), 0),
         min(created_at)
    into v_files, v_bytes, v_first
    from storage.objects
   where bucket_id = 'order-designs'
     and name collate "C" >= v_folder || '/'
     and name collate "C" <  v_folder || '0';
  if v_files >= (case when v_bulk then 5 else 200 end)
     or v_bytes + v_size > (case when v_bulk then 100 else 300 end)::bigint * 1024 * 1024
     or v_first < now() - c_open_for then
    return false;
  end if;

  -- Global budget for the current 10-minute window.
  select coalesce(sum(files), 0), coalesce(sum(bytes), 0) into v_files, v_bytes
    from public.design_upload_windows
   where window_start = date_bin('10 minutes', now(), timestamptz '2000-01-01');
  return v_files < c_window_files and v_bytes + v_size <= c_window_bytes;
end $$;
revoke all on function public.can_upload_order_design(text, text, jsonb) from public;
grant execute on function public.can_upload_order_design(text, text, jsonb) to anon, authenticated;

drop policy if exists "anon upload order-designs" on storage.objects;
create policy "anon upload order-designs" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'order-designs'
    and public.can_upload_order_design(bucket_id, name, metadata)
  );

-- Lookups by designId (upload check, cleanup).
create index if not exists order_items_design_id_idx
  on public.order_items ((design_data ->> 'designId'));
create index if not exists checkout_carts_items_idx
  on public.checkout_carts using gin (items jsonb_path_ops);

-- 5. Orphaned design uploads -------------------------------------------------
-- Files of design / motif folders whose last upload is older than
-- p_older_than and that no order, no recent checkout and no bulk inquiry
-- references. The cleanup-designs Edge Function deletes them through the
-- Storage API (direct deletes on storage.objects are blocked).
create or replace function public.orphan_design_files(p_older_than interval, p_limit integer default 1000)
  returns table (name text, size bigint, created_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp as $$
  with files as (
    select o.name, o.created_at,
           case when o.metadata ->> 'size' ~ '^\d{1,15}$' then (o.metadata ->> 'size')::bigint else 0 end as size,
           case when o.name like 'bulk/%' then split_part(o.name, '/', 2) else split_part(o.name, '/', 1) end as design_id,
           case when o.name like 'bulk/%' then 'bulk/' || split_part(o.name, '/', 2) else split_part(o.name, '/', 1) end as folder
      from storage.objects o
     where o.bucket_id = 'order-designs'
       and o.name ~ '^(bulk/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  ), folders as (
    select folder, design_id, max(created_at) as last_upload
      from files
     group by folder, design_id
  )
  select f.name, f.size, f.created_at
    from files f
    join folders d using (folder)
   where d.last_upload < now() - p_older_than
     and not exists (select 1 from public.order_items i where i.design_data ->> 'designId' = d.design_id)
     -- recent checkouts, and paid ones that could not become an order (the
     -- owner may still have to produce them by hand)
     and not exists (select 1 from public.checkout_carts c
                      where (c.created_at > now() - p_older_than or c.failure_alerted_at is not null)
                        and c.items @> jsonb_build_array(jsonb_build_object('designId', d.design_id)))
     and not exists (select 1 from public.bulk_inquiries b where b.motiv_path like d.folder || '/%')
   order by f.name
   limit greatest(1, least(coalesce(p_limit, 1000), 10000));
$$;
revoke all on function public.orphan_design_files(interval, integer) from public, anon, authenticated;
grant execute on function public.orphan_design_files(interval, integer) to service_role;
