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
| `VITE_USE_MOCK` | `false` (Demo-Modus nur mit exakt `true`; fehlen `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, zeigt die App eine Konfigurationsfehler-Seite statt still in den Demo-Modus zu fallen) |
| `WC_BASE_URL` | WooCommerce REST-URL (für Katalog-Proxy, falls Katalog wieder aktiviert wird) |
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | WooCommerce-Keys (nur server-seitig) |
| `SUPABASE_URL` | wie oben, für die Functions |
| `SUPABASE_ANON_KEY` | wie oben, für die Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim** — nur für die Functions `admin-create-user` (Invite) und `send-order-email` (Empfänger/Inhalt serverseitig laden) |
| `INVITE_REDIRECT_URL` | optional: Ziel-URL des Einladungslinks. Standard: `<Seite>/passwort-setzen`. In Supabase unter Auth → URL Configuration → Redirect URLs `https://<domain>/passwort-setzen` eintragen (gilt auch für „Passwort vergessen“). |
| `RESEND_API_KEY` | für Bestellmails (send-order-email) |
| `ORDER_MAIL_FROM` | verifizierter Absender, z. B. `Ballina <bestellung@ballina.de>` |
| `ORDER_NOTIFY_TO` | optional: Backoffice-Postfach (kommagetrennt) – erhält eine Kopie neuer Bestellungen, Stornos und Reklamationen |

SPA-Redirect + der WooCommerce-Proxy (`/api/wc/*`) sind über `netlify.toml` /
`wc-proxy.mjs` schon konfiguriert.

## 2 · Datenbank-Migrationen

Reihenfolge: `003_platform` → `004_seed` → `005_admin` → `006_phone_and_customer_audit`
→ **`007_security_hardening`** (nach 003/006 — sie verschärft deren Policies) → `008_order_shipping`
(speichert die Versandkosten je Bestellung) → `009_artwork_uploads` (Druckdateien im privaten Bucket `artwork`) → `010_order_status_rules` (erlaubte Statuswechsel)
→ `011_audit_cron` (Audit-Log-RPC mit Benutzer-E-Mail + täglicher Angebotsablauf per pg_cron, s. u.).

```bash
# bestehendes Projekt (003–006 sind live) → 007 bis 011:
./supabase/apply.sh "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
# frisches Projekt → 003 … 011:
./supabase/apply.sh "<conn>" --fresh
```

Vor 007 auf doppelte Nummern prüfen (sonst bricht 007 mit klarer Meldung ab):

```sql
select order_number, count(*) from b2b_orders group by 1 having count(*) > 1;
select quote_number, count(*) from b2b_quotes group by 1 having count(*) > 1;
```

**pg_cron für 011:** Damit abgelaufene Angebote täglich automatisch auf „abgelaufen“
gesetzt werden, muss vorher **Database → Extensions → `pg_cron`** im Supabase-Dashboard
aktiviert sein (011 versucht es sonst selbst per `create extension`). Fehlt es, läuft 011 trotzdem durch (nur ein `NOTICE`), der
Job fehlt dann aber — nach dem Aktivieren 011 einfach erneut ausführen. Prüfen:
`select jobname, schedule from cron.job;` → `ballina-expire-quotes`, `15 23 * * *`
(UTC = 00:15/01:15 Uhr Berlin). Ohne Job ruft die App `expire_quotes()` weiterhin beim
Laden/Annehmen von Angeboten auf.

004/005 legen **keine Passwörter** mehr an: Demo-Kunde und Admin zuerst über
Authentication → Users → „Invite user" einladen, dann 004/005 (erneut) ausführen.

## 3 · Supabase-Dashboard

- **Authentication → Providers → Email:** „Allow new users to sign up" **aus**
  (Kunden werden über das Backoffice angelegt + eingeladen).
- **Authentication → SMTP:** eigenen SMTP-Server hinterlegen — sonst werden
  Invite-/Passwort-Reset-Mails nicht (bzw. nur stark limitiert) versendet.
- **Authentication → Email Templates:** deutsche Vorlagen einspielen (siehe 3a).
- **Database → Extensions → pg_cron:** aktivieren, dann `011_audit_cron.sql` (erneut) ausführen.
- **Authentication → Policies:** Mindestlänge ≥ 10, „Leaked password protection" an.
- **Authentication → MFA:** TOTP aktivieren (empfohlen für den Admin).
- **Database → Backups:** tägliche Backups / PITR aktivieren.

### 3a · E-Mail-Vorlagen (deutsch)

Die Vorlagen liegen unter `supabase/templates/`. Im Dashboard unter
**Authentication → Email Templates** je Tab den Betreff setzen und den kompletten
Dateiinhalt in „Message body“ (Source/HTML) einfügen, dann „Save“:

| Tab im Dashboard | Datei | Betreff |
|---|---|---|
| Invite user | `supabase/templates/invite.html` | `Ihr Zugang zum Ballina B2B-Portal` |
| Reset Password | `supabase/templates/recovery.html` | `Ballina B2B-Portal: Passwort zurücksetzen` |
| Magic Link | `supabase/templates/magic_link.html` | `Ballina B2B-Portal: Ihr Anmeldelink` |
| Change Email Address | `supabase/templates/email_change.html` | `Ballina B2B-Portal: Neue E-Mail-Adresse bestätigen` |

Die Vorlagen nutzen nur Supabase-Variablen (`{{ .ConfirmationURL }}`, `{{ .SiteURL }}`,
`{{ .Email }}`, `{{ .NewEmail }}`). `{{ .ConfirmationURL }}` enthält bereits die
Redirect-URL (`/passwort-setzen`), daher muss unter **Auth → URL Configuration** die
**Site URL** auf die Portal-Domain zeigen und `https://<domain>/passwort-setzen` als
Redirect-URL eingetragen sein. Eigene Vorlagen werden nur mit eigenem SMTP verschickt
(siehe oben). Test: Backoffice → Kunde anlegen (Invite) bzw. Login → „Passwort vergessen?“.

## 4 · Rechtstexte (Pflicht in DE)

`src/pages/Legal.tsx` enthält **Mustertexte**. Vor Livegang durch geprüfte
Impressum-, Datenschutz-, AGB- und Widerruf-Fassungen mit euren echten
Unternehmensdaten ersetzen.

## 5 · Sicherheit

- **Passwörter der Seed-Accounts sofort ändern** (`einkauf@brauhaus-lindental.de`,
  `admin@ballina.de`): sie standen im Klartext in 004/005 (Git-Historie!) und die
  Funktion `seed_auth_user()` war bis 007 für `anon` per REST aufrufbar
  (Passwort jedes Accounts überschreibbar). Authentication → Users → „Send password
  recovery"; `auth.audit_log_entries` auf unerwartete Logins prüfen.
- **DB-Passwort rotieren** (Supabase → Settings → Database) — es lief durch den Chat.
- **WooCommerce-Keys rotieren**, falls der alte `wc-proxy` öffentlich lief (er reichte
  jede WC-GET-Route inkl. `/orders`, `/customers` durch) — und WC-Key auf „Read"
  beschränken.
- Customer-Mutationen laufen nur noch über RPCs (`create_order`, `accept_quote`,
  `decline_quote`, `cancel_order`, `reclaim_order`); Preise kommen nie vom Client.
  Bestellungen mit `price_confirmed = false` im Backoffice prüfen und bestätigen.
- `SUPABASE_SERVICE_ROLE_KEY` **nie** ins Frontend/`VITE_*` — nur als Function-Env.
- Der anon key darf öffentlich sein (durch RLS geschützt).
- Demo-Modus (`VITE_USE_MOCK=true`, nur lokal/Präsentation) nutzt eigene Demo-Passwörter
  (`demo-kunde-2026` / `demo-admin-2026`), die nur gegen localStorage-Daten gelten — sie
  haben nichts mit den echten Accounts zu tun.

## 6 · Bereits erledigt

- Schema + RLS (Firmen-Isolation, `is_admin()`), Migrationen 003/004/005 live.
- Echte Accounts: `einkauf@brauhaus-lindental.de` (Kunde), `admin@ballina.de` (Admin).
- Rechnungen im privaten Storage-Bucket `invoices` (signierte Download-Links);
  Bucket + Policies (Admin: alles, Kunde: nur `<company_id>/…` lesen) seit 007 per SQL.
- Großanfragen schreiben real in `b2b_inquiries`.
- Functions `admin-create-user` (Invite) + `send-order-email` (Resend) liegen bereit.

## 7 · Optional / später

- Katalog wieder aktivieren (Routen `/katalog`, `/produkt/:id` sind nur ausgeblendet).
- Monitoring/Error-Tracking (z. B. Sentry), Rate-Limiting.
- „Passwort setzen"-Seite für Einladungs-/Recovery-Links (`supabase.auth.updateUser`)
  — aktuell landet der Invite-Link nur auf der Site-URL.
- Weitere Mails (Versand, Angebot) analog `send-order-email` ergänzen.
