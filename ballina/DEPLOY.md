# Ballina B2B — Go-Live Runbook

Status: Supabase-Projekt `snmayrrkobiiiyqhdxnj` ist live, Schema + beide Accounts
sind ausgerollt, App läuft im Echt-Modus. Es fehlt nur noch Deployment + ein paar
Dashboard-Einstellungen.

## 1 · Deployment (Netlify)

Repo-Unterordner `ballina/` als Site deployen. `netlify.toml` + Functions liegen bereit.

```
Base directory:     ballina
Build command:      npm run build
Publish directory:  ballina/dist
Functions:          ballina/netlify/functions
```

### Environment-Variablen (Site settings → Environment variables)

| Variable | Zweck |
|---|---|
| `VITE_SUPABASE_URL` | `https://snmayrrkobiiiyqhdxnj.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `VITE_USE_MOCK` | `false` |
| `WC_BASE_URL` | WooCommerce REST-URL (für Katalog-Proxy, falls Katalog wieder aktiviert wird) |
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | WooCommerce-Keys (nur server-seitig) |
| `SUPABASE_URL` | wie oben, für die Functions |
| `SUPABASE_ANON_KEY` | wie oben, für die Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim** — nur für `admin-create-user` (Nutzer anlegen + Invite) |
| `RESEND_API_KEY` | für Bestellmails (send-order-email) |
| `ORDER_MAIL_FROM` | verifizierter Absender, z. B. `Ballina <bestellung@ballina.de>` |

SPA-Redirect + der WooCommerce-Proxy (`/api/wc/*`) sind über `netlify.toml` /
`wc-proxy.mjs` schon konfiguriert.

## 2 · Supabase-Dashboard

- **Authentication → Providers → Email:** „Allow new users to sign up" **aus**
  (Kunden werden über das Backoffice angelegt + eingeladen).
- **Authentication → SMTP:** eigenen SMTP-Server hinterlegen — sonst werden
  Invite-/Passwort-Reset-Mails nicht (bzw. nur stark limitiert) versendet.
- **Authentication → Policies:** Mindestlänge ≥ 10, „Leaked password protection" an.
- **Authentication → MFA:** TOTP aktivieren (empfohlen für den Admin).
- **Database → Backups:** tägliche Backups / PITR aktivieren.

## 3 · Rechtstexte (Pflicht in DE)

`src/pages/Legal.tsx` enthält **Mustertexte**. Vor Livegang durch geprüfte
Impressum-, Datenschutz-, AGB- und Widerruf-Fassungen mit euren echten
Unternehmensdaten ersetzen.

## 4 · Sicherheit

- **DB-Passwort rotieren** (Supabase → Settings → Database) — es lief durch den Chat.
- `SUPABASE_SERVICE_ROLE_KEY` **nie** ins Frontend/`VITE_*` — nur als Function-Env.
- Der anon key darf öffentlich sein (durch RLS geschützt).

## 5 · Bereits erledigt

- Schema + RLS (Firmen-Isolation, `is_admin()`), Migrationen 003/004/005 live.
- Echte Accounts: `einkauf@brauhaus-lindental.de` (Kunde), `admin@ballina.de` (Admin).
- Rechnungen im privaten Storage-Bucket `invoices` (signierte Download-Links).
- Großanfragen schreiben real in `b2b_inquiries`.
- Functions `admin-create-user` (Invite) + `send-order-email` (Resend) liegen bereit.

## 6 · Optional / später

- Katalog wieder aktivieren (Routen `/katalog`, `/produkt/:id` sind nur ausgeblendet).
- Monitoring/Error-Tracking (z. B. Sentry), Rate-Limiting.
- Weitere Mails (Versand, Angebot) analog `send-order-email` ergänzen.
