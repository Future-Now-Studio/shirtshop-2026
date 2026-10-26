#!/usr/bin/env bash
# Apply the Ballina B2B schema to a Supabase project.
#
# Usage:
#   ./supabase/apply.sh "<conn>"                 # EXISTING project (003–006 live): applies 007 → 015
#   ./supabase/apply.sh "<conn>" --fresh         # FRESH project: 003 → 005 → 006 → 007 … 015 (no demo data)
#   ./supabase/apply.sh "<conn>" --fresh --demo  # same + 004 demo customer "Brauhaus Lindental" (never in production)
#
# Always use this script — never run single migration files by hand: 003–006
# re-create older, weaker policies that only 007–014 tighten again. Every file
# is idempotent, so re-running the script is always safe (e.g. after enabling
# pg_cron, or after inviting the admin).
#
# <conn> = IPv4 session-pooler string from: Supabase dashboard → Connect → Session pooler
#   e.g. "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
# (The direct db.<ref>.supabase.co host is IPv6-only and often unreachable.)
# Needs the psql client (macOS: brew install libpq && brew link --force libpq).
#
# No passwords are seeded. 005 marks admin@ballina.de as admin if that user was
# invited; any other admin: invite in Dashboard → Authentication → Users, then
#   select public.b2b_grant_admin('name@firma.de');   (SQL editor, see DEPLOY.md)
set -euo pipefail

CONN="${1:-}"
FRESH=0
DEMO=0
for arg in "${@:2}"; do
  case "$arg" in
    --fresh) FRESH=1 ;;
    --demo) DEMO=1 ;;
    *) echo "error: unknown option $arg (allowed: --fresh, --demo)" >&2; exit 1 ;;
  esac
done
if [ -z "$CONN" ]; then
  echo "error: pass the Postgres connection string as the first argument." >&2
  echo 'e.g. ./supabase/apply.sh "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" [--fresh] [--demo]' >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found — install the PostgreSQL client (macOS: brew install libpq && brew link --force libpq)." >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
export PGCONNECT_TIMEOUT=15

run() {
  echo "→ $1"
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$DIR/migrations/$1"
}

if [ "$FRESH" = 1 ]; then
  run 003_platform.sql                 # schema + RLS
  if [ "$DEMO" = 1 ]; then
    run 004_seed.sql                   # demo company + quote (links an invited demo user)
  fi
  run 005_admin.sql                    # admins, inquiries, admin RLS
  run 006_phone_and_customer_audit.sql # profile phone
elif [ "$DEMO" = 1 ]; then
  run 004_seed.sql                     # demo data on an existing project (test systems only)
fi
# Tightens the policies that 003/005/006 create — must run after them.
run 007_security_hardening.sql
run 008_order_shipping.sql           # stored shipping per order
run 009_artwork_uploads.sql          # real print-file uploads (bucket `artwork`)
run 010_order_status_rules.sql       # allowed status transitions
run 011_audit_cron.sql               # audit-log RPC (actor e-mail) + daily expire_quotes() via pg_cron (if enabled)
run 012_customer_flow.sql            # order meta (Zeichen, Lieferadresse, Wunschtermin), strict create_order/accept_quote
run 013_backoffice.sql               # internal notes, reclamation status, admin RPCs
run 014_hardening.sql                # append-only audit log, mail log, FK restrict, storage limits
run 015_tracking_mail.sql            # mail log key: one "Sendungsverfolgung aktualisiert" mail per tracking change

echo "→ verifying…"
psql "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
select p.email, c.name as company, c.customer_number
  from b2b_profiles p join b2b_companies c on c.id = p.company_id
 order by c.name;
select email as admin from b2b_admins order by email;
select case when count(*) = 0 then 'NO ADMIN – invite one, then select public.b2b_grant_admin(''…'');'
            else count(*) || ' admin(s)' end as admins
  from b2b_admins;
select count(*) as seed_auth_user_left from pg_proc where proname = 'seed_auth_user';
select count(*) as admin_audit_log_rpc from pg_proc where proname = 'admin_audit_log';
select case when exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'pg_cron on' else 'pg_cron OFF – enable in dashboard, re-run apply.sh' end as quote_expiry_cron;
select to_regclass('public.b2b_mail_log') is not null as mail_log_ready;
select count(*) = 1 as tracking_mail_ready from pg_proc where proname = 'b2b_mail_claim_keyed';
select count(*) as history_write_policies_must_be_0
  from pg_policies
 where tablename in ('b2b_audit_log', 'b2b_order_events') and cmd in ('ALL', 'UPDATE', 'DELETE');
do $$
declare r record;
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema missing — buckets not checked';
    return;
  end if;
  for r in execute 'select id, file_size_limit, allowed_mime_types from storage.buckets order by id' loop
    raise notice 'bucket % · max % bytes · %', r.id, coalesce(r.file_size_limit::text, '–'), coalesce(r.allowed_mime_types::text, 'any type');
  end loop;
end $$;
select tablename, policyname, cmd from pg_policies
 where tablename like 'b2b_%' and cmd <> 'SELECT' order by 1, 2;
SQL

echo "✓ done."
echo "  Next: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (VITE_USE_MOCK=false) and the"
echo "  function variables on Netlify, then deploy (see DEPLOY.md)."
