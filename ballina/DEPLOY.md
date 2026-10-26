# Ballina B2B — Go-Live Runbook

> **Stand 26.10.2026 — nicht live-fähig, bevor §0 und §4 erledigt sind.**
> Das gehostete Supabase-Projekt `snmayrrkobiiiyqhdxnj` war bei der letzten Prüfung
> **nicht erreichbar** (DNS-Fehler: typisch für ein pausiertes oder gelöschtes
> Free-Projekt). Ohne diese Datenbank funktionieren Login, Bestellungen, Angebote,
> Backoffice und Mails nicht. Die Rechtstexte enthalten noch Platzhalter.

Reihenfolge für den Livegang: §0 Datenbank → §2 Migrationen → §2a Admin → §3 Dashboard →
§1 Netlify (Env + Deploy) → §4 Rechtstexte → §6 Abnahme.

## 0 · Supabase-Projekt wiederherstellen (Blocker)

1. Im Supabase-Dashboard das Projekt `snmayrrkobiiiyqhdxnj` öffnen.
   - **Pausiert** → „Restore project“. Danach auf einen bezahlten Plan wechseln (Free-Projekte
     pausieren nach einer Woche ohne Zugriffe — mitten im Betrieb wäre das ein Totalausfall)
     und Backups aktivieren (§3).
   - **Gelöscht / nicht mehr vorhanden** → neues Projekt anlegen (Region Frankfurt,
     `eu-central-1`), dann §2 mit `--fresh`, Admin einladen (§2a), alle Supabase-Variablen in
     Netlify (§1) auf das neue Projekt umstellen und neu deployen. Die alten Daten (Demo-Kunde,
     Testbestellungen) sind dann weg — für den Start ist das unkritisch.
2. Prüfen: `./supabase/apply.sh "<conn>"` läuft ohne Fehler durch (§2); Login als Admin und als
   Kunde klappt.

## 1 · Deployment (Netlify)

Repo-Unterordner `ballina/` als eigene Site deployen. `netlify.toml` (Build, Node 22, Functions,
Security-Header) liegt bereit.

```
Base directory:     ballina
Build command:      npm run build
Publish directory:  ballina/dist
Functions:          ballina/netlify/functions
```

Mit gesetztem Base directory baut Netlify die Site nur neu, wenn sich etwas in `ballina/`
ändert. **Erst die Migrationen (§2) einspielen, dann deployen:** die Mail-Function braucht das
Mail-Protokoll aus `014_hardening.sql` und verschickt ohne es nichts (Antwort 503).

### Environment-Variablen (Site settings → Environment variables)

Vorlage mit allen Namen: `.env.example`.

| Variable | Zweck |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` (Build-Zeit, im Browser-Bundle) |
| `VITE_SUPABASE_ANON_KEY` | anon public key (öffentlich, durch RLS geschützt) |
| `VITE_USE_MOCK` | `false` (Demo-Modus nur mit exakt `true`; fehlen URL/Key, zeigt die App eine Konfigurationsfehler-Seite) |
| `SUPABASE_URL` | wie `VITE_SUPABASE_URL`, für die Functions |
| `SUPABASE_ANON_KEY` | wie `VITE_SUPABASE_ANON_KEY`, für die Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim** — nur für die Functions (`admin-create-user`, `send-order-email`, `quote-reminders`); nie mit `VITE_`-Präfix |
| `RESEND_API_KEY` | Resend-API-Key für alle Portal-Mails (§6) |
| `ORDER_MAIL_FROM` | verifizierter Absender, z. B. `Ballina <bestellung@ballina.de>` (Domain in Resend verifizieren: SPF/DKIM) |
| `ORDER_NOTIFY_TO` | **empfohlen:** Backoffice-Postfach (kommagetrennt) für neue Bestellungen, Stornos, Reklamationen und Großanfragen. Leer = an die E-Mail-Adressen der Admins (`b2b_admins`) |
| `PORTAL_URL` | optional: Basis-URL für Links in Mails, z. B. `https://b2b.ballina.de` (Standard: Site-URL von Netlify) |
| `INVITE_REDIRECT_URL` | optional: Ziel des Einladungslinks. Standard: `<Seite>/passwort-setzen`. In Supabase unter Auth → URL Configuration → Redirect URLs `https://<domain>/passwort-setzen` eintragen (gilt auch für „Passwort vergessen“) |
| `WC_BASE_URL` | optional: WooCommerce-REST-URL (https) für den Katalog-Proxy `/api/wc/*`, falls der Katalog wieder aktiviert wird. Ohne Wert antwortet der Proxy mit 503 (kein Staging-Fallback) |
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | WooCommerce-Keys (nur server-seitig, Rechte „Read“) — nur nötig, wenn der Katalog aktiv ist |

SPA-Redirect, Security-Header und die Functions (`/api/wc/*`, `/api/send-order-email`,
`/api/admin-create-user`, täglicher Job `quote-reminders`) sind über `netlify.toml` und die
`config`-Exports der Functions konfiguriert.

## 2 · Datenbank-Migrationen

**Nur über `supabase/apply.sh`** — nie einzelne Dateien von Hand im SQL-Editor ausführen.
003–006 legen ältere, schwächere Policies an, die erst 007–014 wieder verschärfen (Beispiel: ein
erneutes Ausführen von 005 entfernt die Statusprüfung bei Kundenanfragen; 014 stellt sie wieder
her). Alle Dateien sind idempotent; das Skript kann jederzeit erneut laufen. Voraussetzung: der
`psql`-Client (macOS: `brew install libpq && brew link --force libpq`).

```bash
# bestehendes Projekt (003–006 sind live) → 007 bis 015:
./supabase/apply.sh "postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres"
# frisches Projekt → 003, 005, 006, 007 … 015 (ohne Demo-Daten):
./supabase/apply.sh "<conn>" --fresh
# nur Test-/Demo-System: zusätzlich 004 (Demo-Kunde „Brauhaus Lindental“, Angebot AN-2026-0088)
./supabase/apply.sh "<conn>" --fresh --demo
```

`<conn>`: Dashboard → Connect → **Session pooler** (IPv4). Am Ende zeigt das Skript eine Prüfung
(Admins, pg_cron, Mail-Protokoll, Tracking-Mail, Bucket-Limits, Policies).

| Datei | Inhalt |
|---|---|
| `003_platform` | Schema + RLS (Firmen-Isolation) |
| `004_seed` | Demo-Kunde (nur mit `--demo`) |
| `005_admin` | Admins (`b2b_admins`, `is_admin()`), Großanfragen |
| `006_phone_and_customer_audit` | Telefon am Profil |
| `007_security_hardening` | Kunden-Schreibzugriffe nur per RPC, Nummernkreise, `invoices`-Bucket |
| `008_order_shipping` | Versandkosten je Bestellung |
| `009_artwork_uploads` | Druckdateien im privaten Bucket `artwork` |
| `010_order_status_rules` | erlaubte Statuswechsel |
| `011_audit_cron` | Audit-Log-RPC + täglicher Angebotsablauf (pg_cron) |
| `012_customer_flow` | Bestellzeichen, Lieferadresse, Wunschtermin; „Mein Konto“ |
| `013_backoffice` | interne Notizen, Reklamationsstatus, Admin-RPCs |
| `014_hardening` | unveränderliches Audit-Log, Mail-Protokoll, Löschschutz für Kunden mit Bestellungen, Upload-Limits, Admin-Verwaltung |
| `015_tracking_mail` | Mail-Protokoll mit Schlüssel: „Sendungsverfolgung aktualisiert“ einmal je geänderter Sendungsnummer |

Die alten Dateien 001/002 liegen in `supabase/_superseded/` und dürfen **nie** ausgeführt werden.

Vor 007 auf doppelte Nummern prüfen (sonst bricht 007 mit klarer Meldung ab):

```sql
select order_number, count(*) from b2b_orders group by 1 having count(*) > 1;
select quote_number, count(*) from b2b_quotes group by 1 having count(*) > 1;
```

**pg_cron für 011:** Damit abgelaufene Angebote täglich auf „abgelaufen“ gesetzt werden, muss
**Database → Extensions → `pg_cron`** aktiviert sein (011 versucht es sonst selbst). Fehlt es,
läuft alles trotzdem durch (nur ein `NOTICE`) — nach dem Aktivieren `apply.sh` erneut ausführen.
Prüfen: `select jobname, schedule from cron.job;` → `ballina-expire-quotes`, `15 23 * * *`
(UTC = 00:15/01:15 Uhr Berlin). Ohne Job ruft die App `expire_quotes()` beim Laden/Annehmen auf.

### 2a · Backoffice-Admins verwalten

Admin ist, wer in `b2b_admins` steht. 005 trägt nur `admin@ballina.de` automatisch ein (falls
eingeladen). Weitere oder andere Admins:

1. Dashboard → Authentication → Users → „Invite user“ (E-Mail der Person). Die Person setzt über
   den Link ihr Passwort.
2. SQL-Editor: `select public.b2b_grant_admin('name@firma.de');`
3. Entfernen: `select public.b2b_revoke_admin('name@firma.de');` (der letzte Admin bleibt immer).

Kundenzugänge können nicht gleichzeitig Admin sein. Admins melden sich unter `/login` an und
landen im Backoffice (`/admin`). MFA für Admins aktivieren (§3). Beide Aktionen stehen im Audit-Log.

### 2b · Kunden anlegen

Nur über **Backoffice → Kunden → Neuer Kunde**: legt Firma + Login an und verschickt die
Einladung (Function `admin-create-user`). Ein Kunde = ein Login. Doppelklick/erneutes Absenden
mit derselben E-Mail löscht nichts mehr, sondern meldet „Für diese E-Mail-Adresse existiert
bereits ein Zugang“. Einladung verloren oder abgelaufen → **Kunde öffnen → „Einladung erneut
senden“** (gleiche Kunden-ID + E-Mail erneut an die Function; geht nur, solange der Kunde noch
kein Passwort gesetzt hat). Hat er es schon gesetzt → auf der Login-Seite „Passwort vergessen?“.

### 2c · Demo-Daten entfernen (falls 004 in Produktion lief)

```sql
-- SQL-Editor; nur wenn der Demo-Kunde keine echten Bestellungen hat
with c as (select id from b2b_companies where customer_number = 'B2B-10428')
delete from b2b_quotes where company_id in (select id from c);
with c as (select id from b2b_companies where customer_number = 'B2B-10428')
delete from b2b_orders where company_id in (select id from c);
delete from b2b_companies where customer_number = 'B2B-10428';
```

Danach den Benutzer `einkauf@brauhaus-lindental.de` unter Authentication → Users löschen.
Firmen mit Bestellungen oder Angeboten lassen sich sonst nicht löschen (Aufbewahrungspflicht).

## 3 · Supabase-Dashboard

- **Authentication → Providers → Email:** „Allow new users to sign up" **aus**
  (Kunden werden über das Backoffice angelegt + eingeladen).
- **Authentication → SMTP:** eigenen SMTP-Server hinterlegen — sonst werden Einladungs- und
  Passwort-Mails nicht (bzw. nur wenige pro Stunde) versendet. Bei erreichtem Limit meldet
  „Neuer Kunde“ jetzt verständlich „E-Mail-Limit erreicht“.
- **Authentication → Email Templates:** deutsche Vorlagen einspielen (siehe 3a).
- **Authentication → URL Configuration:** Site URL = Portal-Domain, Redirect URL
  `https://<domain>/passwort-setzen`.
- **Database → Extensions → pg_cron:** aktivieren, dann `apply.sh` erneut ausführen.
- **Authentication → Policies:** Mindestlänge ≥ 10, „Leaked password protection" an.
- **Authentication → MFA:** TOTP aktivieren (empfohlen für Admins).
- **Database → Backups:** tägliche Backups / PITR aktivieren (bezahlter Plan).

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
Redirect-URL (`/passwort-setzen`). Eigene Vorlagen werden nur mit eigenem SMTP verschickt.
Test: Backoffice → Kunde anlegen (Invite) bzw. Login → „Passwort vergessen?“.

## 4 · Rechtstexte (Pflicht in DE, Blocker)

Alle Firmendaten und Rechtstexte stehen an einer Stelle: **`src/lib/legal.ts`**. Jeden Wert in
`«…»` im Objekt `COMPANY` ersetzen (Firma inkl. Rechtsform, Anschrift, Geschäftsführung, Telefon,
E-Mail, Registergericht/HRB, USt-IdNr., Aufsichtsbehörde, Gerichtsstand), die Texte
(Impressum, Datenschutz inkl. Auftragsverarbeiter Supabase, Netlify, Resend, AGB, Widerruf)
anwaltlich prüfen lassen und dann `LEGAL_FINAL = true` setzen — bis dahin zeigen die Seiten einen
Entwurfs-Hinweis. Die Daten erscheinen auch auf Angeboten und Lieferscheinen. Neu bauen und
deployen.

## 5 · Sicherheit

- **Passwörter der Seed-Accounts ändern** (`einkauf@brauhaus-lindental.de`, `admin@ballina.de`):
  sie standen im Klartext in 004/005 (Git-Historie!) und `seed_auth_user()` war bis 007 für
  `anon` per REST aufrufbar. Authentication → Users → „Send password recovery";
  `auth.audit_log_entries` auf unerwartete Logins prüfen.
- **DB-Passwort, anon- und service_role-Key rotieren** (Settings → Database / API) — sie liefen
  durch den Chat. Danach die Werte in Netlify aktualisieren.
- **WooCommerce-Keys rotieren**, falls der alte `wc-proxy` öffentlich lief (er reichte jede
  WC-GET-Route inkl. `/orders`, `/customers` durch) — und WC-Key auf „Read" beschränken.
- Kunden schreiben nur über RPCs (`create_order`, `accept_quote`, `decline_quote`,
  `cancel_order`, `reclaim_order`, `update_my_profile`, …); Preise kommen nie vom Client.
  Bestellungen mit `price_confirmed = false` im Backoffice prüfen und bestätigen.
- Audit-Log und Bestell-Verlauf sind unveränderlich (014); Sendungsdaten, Anfrage-Status und
  Admin-Ernennungen protokolliert die Datenbank selbst.
- `SUPABASE_SERVICE_ROLE_KEY` **nie** ins Frontend/`VITE_*` — nur als Function-Env.
- Security-Header (Clickjacking-Schutz, CSP) kommen aus `netlify.toml`; die vollständige CSP läuft
  zunächst als Report-Only (Details in `supabase/SECURITY.md`).
- Demo-Modus (`VITE_USE_MOCK=true`, nur lokal/Präsentation) nutzt eigene Demo-Passwörter
  (`demo-kunde-2026` / `demo-admin-2026`), die nur gegen localStorage-Daten gelten.

## 6 · Portal-Mails und Abnahme

Alle Mails laufen über Resend (`send-order-email`, `quote-reminders`). Empfänger und Inhalte lädt
der Server aus der Datenbank; jedes Ereignis geht pro Bestellung/Angebot/Anfrage **höchstens
einmal** raus (Tabelle `b2b_mail_log`; Ausnahme „Sendungsverfolgung aktualisiert“: einmal je
geänderter Sendungsnummer/Versanddienst, 015). Fehlgeschlagene Sendungen können erneut ausgelöst
werden.

| Ereignis | Auslöser | Empfänger |
|---|---|---|
| Bestellbestätigung | Kunde bestellt / nimmt Angebot an (oder Admin legt Bestellung mit „Kunde benachrichtigen“ an) | Kunde; Kopie ans Backoffice (nur bei Kundenaktion) |
| Preise bestätigt | Admin bestätigt vorläufige Preise | Kunde |
| Versandt | Admin setzt Status „Versendet“ (inkl. Sendungsnummer) oder legt eine Bestellung direkt als „Versendet“ mit „Kunde benachrichtigen“ an (nach der Bestellbestätigung) | Kunde |
| Sendungsverfolgung aktualisiert | Admin ändert Versanddienst/Sendungsnummer einer versendeten Bestellung, nachdem die Versand-Mail raus ist | Kunde |
| Storno | Kunde oder Admin storniert | Kunde; Kopie ans Backoffice (nur bei Kundenaktion) |
| Reklamation | Kunde reklamiert | Kunde; Kopie ans Backoffice |
| Neues Angebot | Admin legt Angebot an | Kunde (Nummer, Positionen, gültig bis, Link) |
| Angebots-Erinnerung | täglich 06:30 UTC, Angebot läuft in ≤ 3 Tagen ab | Kunde |
| Neue Großanfrage | Kunde sendet Anfrage | Backoffice (`ORDER_NOTIFY_TO`, sonst Admins) |

Abnahme nach dem Deploy: als Kunde bestellen → Bestätigung + Backoffice-Kopie kommen an; als Admin
Preise bestätigen, auf „Versendet“ setzen, danach die Sendungsnummer ändern, Angebot anlegen →
jeweils eine Mail; Großanfrage senden → Backoffice-Mail. In Netlify → Functions → `send-order-email` die Logs prüfen.

## 7 · Optional / später

- Katalog wieder aktivieren (Routen `/katalog`, `/produkt/:id` sind nur ausgeblendet; dann
  `WC_*` setzen).
- Monitoring/Error-Tracking (z. B. Sentry).
- CSP nach einigen Tagen ohne Verstöße von Report-Only auf erzwungen umstellen (`SECURITY.md`).
