-- Allowed order status transitions. Before, any status could be set at any
-- time (e.g. a cancelled order back to "offen"). Keep in sync with
-- NEXT_STATUS in src/lib/utils.ts. Idempotent; run after 007.
create or replace function public.b2b_orders_check_status()
  returns trigger
  language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'offen'          and new.status in ('in_bearbeitung', 'versendet', 'storniert'))
    or (old.status = 'in_bearbeitung' and new.status in ('offen', 'versendet', 'storniert'))
    or (old.status = 'versendet'      and new.status in ('abgeschlossen'))
  ) then
    raise exception 'Statuswechsel von "%" nach "%" ist nicht erlaubt', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists b2b_orders_check_status on public.b2b_orders;
create trigger b2b_orders_check_status
  before update of status on public.b2b_orders
  for each row execute function public.b2b_orders_check_status();
