-- ===========================================================================
-- Ballina B2B · 015 tracking mail
-- Run AFTER 014_hardening.sql (always via ./supabase/apply.sh). Idempotent;
-- safe to re-run. Runs in one transaction.
--
-- b2b_mail_log (014) allows one mail per (event, ref). The mail
-- "Sendungsverfolgung aktualisiert" (event tracking_updated, send-order-email)
-- has to go out once per DISTINCT tracking change instead. The log row keeps a
-- key (md5 of the tracking data the mail was sent for); b2b_mail_claim_keyed()
-- re-claims an already sent row only when the key differs. The same key again
-- (double click, re-save, retry) sends nothing. `attempts` then counts every
-- claim of the row, not only retries.
-- ===========================================================================

begin;

alter table public.b2b_mail_log add column if not exists mail_key text;

create or replace function public.b2b_mail_claim_keyed(p_event text, p_ref uuid, p_key text, p_actor uuid default null)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'Mail-Schlüssel fehlt.' using errcode = '22023';
  end if;
  insert into b2b_mail_log as m (event, ref_id, actor, mail_key)
  values (p_event, p_ref, p_actor, md5(p_key))
  on conflict (event, ref_id) do update
     set status = 'sending', claimed_at = now(), sent_at = null,
         actor = excluded.actor, attempts = m.attempts + 1, mail_key = excluded.mail_key
   where m.status = 'failed'
      or (m.status = 'sending' and m.claimed_at < now() - interval '10 minutes')
      or (m.status in ('sent', 'historic') and m.mail_key is distinct from excluded.mail_key)
  returning id into v_id;
  return v_id is not null;
end $$;

-- Netlify functions only (service_role), like b2b_mail_claim / b2b_mail_done.
revoke all on function public.b2b_mail_claim_keyed(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.b2b_mail_claim_keyed(text, uuid, text, uuid) to service_role;

commit;

-- ===========================================================================
-- Verify (as postgres):
--   select event, ref_id, status, attempts, mail_key from b2b_mail_log
--    where event = 'tracking_updated' order by claimed_at desc limit 10;
-- ===========================================================================
