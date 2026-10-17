-- ===========================================================================
-- Ballina B2B · 011 audit-log RPC + daily quote expiry (pg_cron)
-- Run AFTER 007 (uses is_admin(), expire_quotes()). Idempotent; safe to re-run.
--
--   1. admin_audit_log(): admin-only, paged (keyset on at/id) read of the
--      audit log WITH the actor's e-mail. A plain join is not possible from the
--      browser: b2b_audit_log.actor has no FK to the profile/admin tables and
--      b2b_admins is only readable for the own row under RLS, so the e-mail is
--      resolved here (SECURITY DEFINER) from auth.users.
--   2. Indexes for the paged admin lists.
--   3. Schedules `select public.expire_quotes()` daily via pg_cron — only if
--      the extension is available/enabled. Otherwise a NOTICE is raised and the
--      migration still succeeds (the app keeps calling expire_quotes() when
--      quotes are listed/accepted). Enable it in the dashboard
--      (Database → Extensions → pg_cron) and re-run this file.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Audit log with actor e-mail (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_audit_log(
  p_limit     integer     default 100,
  p_before_at timestamptz default null,
  p_before_id bigint      default null
)
returns table (
  id           bigint,
  at           timestamptz,
  actor        uuid,
  actor_email  text,
  company_id   uuid,
  company_name text,
  action       text,
  entity       text,
  entity_id    text,
  meta         jsonb
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Nur Admins.' using errcode = '42501';
  end if;
  return query
    select a.id, a.at, a.actor,
           coalesce(u.email::text, ad.email, pr.email) as actor_email,
           a.company_id, c.name as company_name,
           a.action, a.entity, a.entity_id, a.meta
      from public.b2b_audit_log a
      left join auth.users u          on u.id = a.actor
      left join public.b2b_admins ad  on ad.user_id = a.actor
      left join public.b2b_profiles pr on pr.user_id = a.actor
      left join public.b2b_companies c on c.id = a.company_id
     where p_before_at is null
        or a.at < p_before_at
        or (a.at = p_before_at and a.id < coalesce(p_before_id, 9223372036854775807))
     order by a.at desc, a.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

revoke all on function public.admin_audit_log(integer, timestamptz, bigint) from public, anon;
grant execute on function public.admin_audit_log(integer, timestamptz, bigint) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Indexes for the paged lists ("Mehr laden")
-- ---------------------------------------------------------------------------
create index if not exists idx_audit_at_id       on public.b2b_audit_log (at desc, id desc);
create index if not exists idx_orders_created_at on public.b2b_orders (created_at desc);
create index if not exists idx_orders_company_created on public.b2b_orders (company_id, created_at);

commit;

-- ---------------------------------------------------------------------------
-- 3. Daily quote expiry via pg_cron (optional — never fails the migration)
-- ---------------------------------------------------------------------------
-- 23:15 UTC = 00:15 (CET) / 01:15 (CEST) Europe/Berlin, i.e. always just after
-- the Berlin day boundary that b2b_quote_valid() uses. pg_cron runs in UTC.
-- Outside the transaction above so a pg_cron problem can never roll back 1./2.
do $cron$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available on this server — skipping daily expire_quotes() job. '
                 'Enable it under Database → Extensions → pg_cron and re-run 011.';
    return;
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension pg_cron;
    exception when others then
      raise notice 'pg_cron could not be enabled (%). Enable it under Database → Extensions → pg_cron and re-run 011.',
        sqlerrm;
      return;
    end;
  end if;

  begin
    -- cron.schedule(name, …) upserts the job with that name (pg_cron ≥ 1.3).
    perform cron.schedule('ballina-expire-quotes', '15 23 * * *', 'select public.expire_quotes();');
    raise notice 'pg_cron job "ballina-expire-quotes" scheduled (daily 23:15 UTC).';
  exception when others then
    raise notice 'Scheduling the pg_cron job failed (%) — skipped.', sqlerrm;
  end;
end
$cron$;

-- ===========================================================================
-- Verify:
--   select jobname, schedule, command from cron.job;          -- if pg_cron is on
--   select * from public.admin_audit_log(5);                  -- as an admin user
-- ===========================================================================
