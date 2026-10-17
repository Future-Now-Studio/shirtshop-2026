# Ballina B2B — Security & Access

What the SQL migrations enforce, and what you must set in the Supabase dashboard.
Model: **one customer = one account** (no roles, no team, no approval workflow).

## Enforced by SQL (`003_platform.sql`)

- **Company isolation (RLS)** — every table is row-level secured to
  `current_company_id()`. A customer can never read/write another company's
  orders, quotes, profile or audit log. Enforced via a `SECURITY DEFINER` helper
  (so no RLS recursion).
- **Audit log** — back-office order/quote actions are written to `b2b_audit_log`
  (actor = `auth.uid()`), readable only within the company, never
  updatable/deletable.
- **Status history** — order status changes are captured automatically into
  `b2b_order_events` (tamper-evident timeline).

## Hardening (`007_security_hardening.sql`)

- `seed_auth_user()` removed (was a public password-reset backdoor); no
  passwords in any migration.
- Customers have **read-only** table access. All customer writes go through
  `SECURITY DEFINER` RPCs that check ownership + state:
  `create_order` (prices derived server-side from the company's confirmed
  order history; otherwise `price_confirmed = false` for back-office review),
  `accept_quote` (atomic, checks status + `valid_until`), `decline_quote`,
  `cancel_order` (only while `offen`), `reclaim_order`, `expire_quotes`.
  Admin-only: `admin_confirm_order_prices`.
- Profiles cannot be inserted/re-pointed by customers (policy + trigger on
  `user_id`/`company_id`/`email`).
- Audit entries for customer actions are written by the RPCs; customers cannot
  insert audit rows.
- Order/quote/customer numbers come from DB sequences; UNIQUE constraints.
- Private `invoices` bucket: admins full access, customers read `<company_id>/…`.

## Configure in the Supabase dashboard (cannot be done in SQL)

1. **Disable public sign-ups** → Authentication → Providers → Email →
   *Allow new users to sign up* → **off**. Customer accounts are created from the
   back-office and receive an invite to set a password.
2. **Password policy** → Authentication → Policies → set **minimum length ≥ 10**
   and enable "leaked password protection" (HaveIBeenPwned).
3. **MFA / 2FA** → Authentication → enable **TOTP MFA** (recommended for all
   accounts).
4. **Session timeout** → Authentication → Sessions → set a **JWT expiry** and
   **inactivity timeout** appropriate for B2B (e.g. 8 h / refresh 7 d).
5. **Secrets** — the WooCommerce keys live only server-side (Vite dev proxy /
   Netlify function env). The **service_role** key must NEVER ship in the
   frontend bundle. Only `anon` + URL go into `VITE_*`.
6. **Backups** → Database → enable **daily backups** (Point-in-Time Recovery on
   paid plans) and note the restore procedure.
7. **Rotate** the anon/service keys and the DB password after this build shares
   them, since they passed through chat.

## Apply

```bash
# existing project (003–006 live) → applies 007 only; add --fresh for a new project
./supabase/apply.sh "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```
