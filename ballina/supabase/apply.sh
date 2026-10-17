#!/usr/bin/env bash
# Apply the Ballina B2B schema to a Supabase project.
#
# Usage:
#   ./supabase/apply.sh "<conn>"            # EXISTING project (003–006 already live): applies 007–011
#   ./supabase/apply.sh "<conn>" --fresh    # FRESH project: 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011
#
# <conn> = IPv4 session-pooler string from: Supabase dashboard → Connect → Session pooler
#   e.g. "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
# (The direct db.<ref>.supabase.co host is IPv6-only and often unreachable.)
#
# No passwords are seeded. Before --fresh (or afterwards, then re-run 004/005),
# invite the demo users in Dashboard → Authentication → Users → "Invite user":
#   einkauf@brauhaus-lindental.de (customer), admin@ballina.de (admin)
# 004/005 only link EXISTING auth users to the demo company / admin table.
set -euo pipefail

CONN="${1:-}"
MODE="${2:-}"
if [ -z "$CONN" ]; then
  echo "error: pass the Postgres connection string as the first argument." >&2
  echo 'e.g. ./supabase/apply.sh "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" [--fresh]' >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
export PGCONNECT_TIMEOUT=15

run() {
  echo "→ $1"
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$DIR/migrations/$1"
}

if [ "$MODE" = "--fresh" ]; then
  run 003_platform.sql                 # schema + RLS
  run 004_seed.sql                     # demo company + quote (links invited user)
  run 005_admin.sql                    # admins, inquiries, admin RLS
  run 006_phone_and_customer_audit.sql # profile phone
fi
# Tightens the policies that 003/006 create — must run after them.
run 007_security_hardening.sql
run 008_order_shipping.sql           # stored shipping per order
run 009_artwork_uploads.sql          # real print-file uploads (bucket `artwork`)
run 010_order_status_rules.sql       # allowed status transitions
run 011_audit_cron.sql               # audit-log RPC (actor e-mail) + daily expire_quotes() via pg_cron (if enabled)

echo "→ verifying…"
psql "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
select p.email, c.name as company, c.customer_number
  from b2b_profiles p join b2b_companies c on c.id = p.company_id
 order by c.name;
select email as admin from b2b_admins order by email;
select count(*) as seed_auth_user_left from pg_proc where proname = 'seed_auth_user';
select count(*) as admin_audit_log_rpc from pg_proc where proname = 'admin_audit_log';
select case when exists (select 1 from pg_extension where extname = 'pg_cron')
            then 'pg_cron on' else 'pg_cron OFF – enable in dashboard, re-run 011' end as quote_expiry_cron;
select tablename, policyname, cmd from pg_policies
 where tablename like 'b2b_%' and cmd <> 'SELECT' order by 1, 2;
SQL

echo "✓ done."
echo "  Next: rotate the passwords of the previously seeded accounts (see 007 header),"
echo "  set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK=false, then rebuild."
