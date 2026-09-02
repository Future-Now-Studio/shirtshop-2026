#!/usr/bin/env bash
# Apply the Ballina B2B schema + seed to a Supabase project in one shot.
# Usage: ./supabase/apply.sh "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#
# Get the IPv4 pooler string from: Supabase dashboard → Connect → Session pooler.
# (The direct db.<ref>.supabase.co host is IPv6-only and often unreachable.)
set -euo pipefail

CONN="${1:-}"
if [ -z "$CONN" ]; then
  echo "error: pass the Postgres connection string as the first argument." >&2
  echo 'e.g. ./supabase/apply.sh "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"' >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
export PGCONNECT_TIMEOUT=15

echo "→ 003_platform.sql (schema + RLS + security)…"
psql "$CONN" -v ON_ERROR_STOP=1 -f "$DIR/migrations/003_platform.sql"

echo "→ 004_seed.sql (company + users + quote)…"
psql "$CONN" -v ON_ERROR_STOP=1 -f "$DIR/migrations/004_seed.sql"

echo "→ verifying…"
psql "$CONN" -c "select email, role, approved from b2b_profiles order by role;"

echo "✓ done. Demo login: einkauf@brauhaus-lindental.de / Ballina2026!"
echo "  Next: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK=false, then rebuild."
