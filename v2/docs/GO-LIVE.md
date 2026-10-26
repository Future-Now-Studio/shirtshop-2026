# Private Shirt v2 — Go-Live-Runbook

Reihenfolge für den Umzug von private-shirt.de (WordPress) auf den neuen Shop.
Jeder Schritt hat eine Prüfung. Platzhalter: `<ref>` = Supabase-Projekt-Ref,
`<site>` = Netlify-Site-Name. **Secrets nie in Git, Chat oder Tickets** — nur in
Supabase-Secrets, Netlify-Env oder einer gitignorten Datei (`*.env`, `.env.*`).

Der B2B-Portal-Teil (ballina) hat ein eigenes Runbook: `ballina/DEPLOY.md`.

---

## 0 · Sofort (vor jeder Demo): Supabase-Projekte erreichbar?

Stand 26.10.2026: Die gehosteten Projekte von v2 (`txlveylstxrjpsissagz`, siehe
Root-`.env`) **und** ballina (`snmayrrkobiiiyqhdxnj`) lösen im DNS nicht auf
(NXDOMAIN). Typische Ursache: Free-Projekt nach Inaktivität pausiert; pausierte
Free-Projekte können nach ~90 Tagen gelöscht werden.

1. Supabase-Dashboard öffnen → beide Projekte suchen.
2. **Pausiert:** „Restore project“, danach sofort auf **Pro** upgraden (kein
   Auto-Pause, tägliche Backups). Prüfen:
   `curl -s -o /dev/null -w "%{http_code}\n" https://<ref>.supabase.co/auth/v1/health -H "apikey: <anon key>"` → `200`.
3. **Gelöscht:** neues Projekt (Region `eu-central-1` Frankfurt, Pro) und die
   Schritte 1–7 komplett ausführen (Katalog neu importieren, siehe 2.3).
   Neue URL + Keys danach in Netlify, lokalen `.env`-Dateien und Stripe-Webhook
   eintragen. Für ballina: `ballina/DEPLOY.md` §2 mit `--fresh`.
4. Bis das geklärt ist, nur lokal demonstrieren (`supabase start`, siehe README).

---

## 1 · Supabase-Projekt

- Plan **Pro** (Backups, keine Pause, Leaked-Password-Schutz, Session-Limits).
- Region Frankfurt (`eu-central-1`) — DSGVO, kurze Wege.
- **Settings → API Keys:** Für `VITE_SUPABASE_ANON_KEY` den **Legacy anon key**
  (JWT, beginnt mit `eyJ`) verwenden. Mit dem neuen Publishable Key
  (`sb_publishable_…`) lehnen die Edge Functions mit JWT-Prüfung (alle außer
  `stripe-webhook`) die Aufrufe des Shops ab — Checkout und Formulare wären tot.
- **Database → Extensions → `pg_cron`** aktivieren (vor den Migrationen).
- DB-Passwort in den Passwortmanager, nirgends sonst.

## 2 · Datenbank

### 2.1 Migrationen — einziger Weg: `supabase link` + `supabase db push`

```bash
cd v2
supabase link --project-ref <ref>
supabase migration list          # lokal vs. remote
supabase db push --dry-run       # zeigt, was ausgeführt würde
supabase db push                 # alle Dateien aus supabase/migrations
```

- **Kein** `supabase config push`: das würde die lokalen Auth-URLs
  (`127.0.0.1`) ins Live-Projekt schreiben. Auth wird im Dashboard gesetzt (§3).
- Wurde ein bestehendes Projekt früher per SQL-Editor eingerichtet (alte
  `SETUP_ALL.sql`/`APPLY_PENDING.sql`), ist die Migrations-Historie leer und
  `db push` würde alles erneut ausführen. Dann die bereits vorhandenen Versionen
  markieren: `supabase migration repair --status applied <version> …`
  (Version = Zahl vor dem `_` im Dateinamen), danach `db push --dry-run`.
- Prüfen:
  - `select jobname, schedule from cron.job;` → `purge-checkout-carts` (`17 3 * * *`).
  - Storage → Buckets: `product-images` (öffentlich), `order-designs`,
    `design-renders`, `invoices` (alle privat).

### 2.2 Admin anlegen

1. Erst §3 (Auth, SMTP, Site URL) erledigen.
2. Authentication → Users → **Invite user** mit der Admin-Adresse.
3. SQL-Editor: `insert into public.admins (user_id) select id from auth.users where email = '<admin-mail>';`
4. Einladungsmail → Link → `/admin/passwort-setzen` → Passwort (≥ 12 Zeichen,
   Buchstaben + Ziffern) → Login unter `/admin`.
5. Admin → **Einstellungen**: Bestell-Postfach (`order_email`), Versandkosten,
   MwSt., Lieferzeit prüfen.

### 2.3 Katalog (nur bei neuem Projekt)

Der Katalog kam aus WooCommerce (`timob10.sg-host.com`) und wurde danach von
Hand nachbearbeitet. Ein neuer Import braucht den **neuen, rotierten**
Read-only-WooCommerce-Key (§13) in `v2/.env` (`WC_BASE_URL`, `WC_CONSUMER_KEY`,
`WC_CONSUMER_SECRET`, dazu `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

```bash
node scripts/import-woo.mjs           # Produkte als Entwurf, Farben, Frontbilder
node scripts/normalize-categories.mjs
node scripts/reimport-images.mjs      # Ansichten je Farbe
node scripts/prepare-imported.mjs     # Größen S–XXL + Bestand
node scripts/fill-front-fallback.mjs
node scripts/derive-variant-hex.mjs   # Swatch-Farben
node scripts/audit-colors.mjs         # nur Bericht
```

Danach im Admin jedes Produkt prüfen (Bilder, Größen, Preise, **Druckzonen**,
§4.2) und veröffentlichen. `import-expresser.mjs` braucht die lokalen
Originalbilder („Expresser 2.0 Bilder“ im Downloads-Ordner).

## 3 · Auth-Härtung (Dashboard)

Die lokalen Werte stehen in `supabase/config.toml`; im gehosteten Projekt von Hand setzen:

| Wo | Einstellung |
|---|---|
| Authentication → Sign In / Providers → Email | „Allow new users to sign up“ **aus** (nur eingeladene Admins) |
| Authentication → URL Configuration | Site URL `https://private-shirt.de`; Redirect URLs: `https://private-shirt.de/admin/passwort-setzen` (während der Tests zusätzlich `https://<site>.netlify.app/admin/passwort-setzen`, danach entfernen) |
| Authentication → Passwords | Mindestlänge **12**, Anforderung „Letters and digits“, **Leaked password protection an** (Pro), „Secure password change“ an |
| Authentication → Sessions (Pro) | Inaktivität 8 h, Time-box 24 h (nur Admins melden sich an) |
| Authentication → SMTP | **Eigenes SMTP** (z. B. Resend: `smtp.resend.com`, Port 465, User `resend`, Passwort = eigener Resend-API-Key, Absender `no-reply@private-shirt.de`). Ohne eigenes SMTP verschickt Supabase nur wenige Mails pro Stunde und nur an Team-Adressen — Einladung/Passwort-Reset kämen nicht an. |
| Authentication → Rate Limits | Mail-Limit nach SMTP-Umstellung z. B. auf 30/h |
| Authentication → Email Templates | Inhalte aus `supabase/templates/*.html`, Betreffzeilen aus `supabase/config.toml` (`[auth.email.template.*]`). Invite/Recovery verlinken auf `{{ .SiteURL }}/admin/passwort-setzen` — deshalb muss die Site URL stimmen. |

- **MFA:** Der Admin-Login des Shops hat noch keinen TOTP-Schritt. Bis dahin:
  einzigartiges Passwort aus dem Passwortmanager, möglichst nur ein Admin-Konto.
- Test: Login-Seite → „Passwort vergessen“ → Mail kommt an → Link öffnet `/admin/passwort-setzen`.

## 4 · Storage und Designer-Daten

### 4.1 Buckets

| Bucket | Zugriff | Inhalt |
|---|---|---|
| `product-images` | öffentlich lesbar, Schreiben nur Admin | `<productId>/<variantId>/<view>.<ext>` |
| `order-designs` | privat; anonym nur Upload (25 MB/Datei, Typen begrenzt), Lesen nur Admin | Designer-Dateien und Großbestellungs-Motive |
| `design-renders` | privat | ältere Render-Dateien (vom Shop nicht mehr beschrieben) |
| `invoices` | privat; Lesen Admin, Schreiben nur Edge Functions | Rechnungs-/Storno-PDFs (GoBD: einmal erzeugt, nie geändert) |

### 4.2 Designer → Druckdaten

Jedes „In den Warenkorb“ aus dem Designer legt einen neuen Ordner
`order-designs/<designId>/` an (zufällige UUID, Dateien werden nie überschrieben).
Je gestalteter Ansicht `<v>` (`front`, `back`, `left`, `right`):

| Datei | Zweck |
|---|---|
| `<v>-print.png` | **Druckdatei**: auf Druckzone/Motiv zugeschnitten, transparent, ~4000 px lange Kante (≤ 16 MP); Maß in cm und DPI stehen im Manifest |
| `<v>-element-<n>.png` | jedes Element einzeln (Text bis 2500 px, Bilder 1200 px Vorschau) |
| `<v>-original-<n>.<ext>` | unveränderte Original-Datei des Kunden (Foto/Logo/SVG) |
| `<v>-composite.png` | Vorschau Shirt + Motiv (720 px) |
| `<v>-design.png` | ganzes Motiv ohne Shirt, transparent (960 px) |
| `design.json` | Fabric-JSON je Ansicht (`{front:{objects:[…]},…}`), Druckzonen als `__zone`; Bilder verweisen auf die Originale |

Großbestellungs-Motive liegen unter `order-designs/bulk/<uuid>/<datei>`.

- **Manifest** (`order_items.design_data`): je Element Ansicht, Text, Schrift,
  Farbe, Position, Datei, Druckdatei, Druckmaß (`printCmW`/`printCmH`), DPI,
  Druckzone, Element-Box in cm, Original-Datei, Freigabezeitpunkt.
- **Maße:** Die physische Größe kommt aus dem Namen der Druckzone, z. B.
  „Brust groß 30x40 cm“. Ohne Maß im Namen gilt die Schätzung
  „Canvas 480 px ≈ 80 cm“ und das Manifest markiert `sizeEstimated`. → Im Admin
  **jede Druckzone mit Maß benennen**.
- **Auflösung:** ≥ 150 DPI gut, 100–150 DPI grenzwertig, < 100 DPI unscharf
  (der Designer warnt den Kunden).
- **Ablauf Admin:** Produkte → Produkt → Druckzonen je Ansicht zeichnen und
  benennen → veröffentlichen. Bestellung: Admin → Bestellungen → Bestellung →
  Druckdateien ansehen/laden oder **„Design-Dateien (ZIP)“** (alle Dateien je
  Position inkl. `design.json` plus `PRODUKTION.txt` mit Größen/Farben und je
  Ansicht Druckdatei, Druckmaß in cm, DPI, Druckzone und Warnhinweisen) → an
  die Produktion.
- **Aufbewahrung:**
  - Dateien bestellter Designs bleiben, solange die Bestellung existiert
    (Produktion, Reklamation, Gewährleistung).
  - DSGVO-Löschwunsch: Admin → Bestellung → Datenschutz → „Kundendaten
    anonymisieren“ (Funktion `anonymize-order`) entfernt Personendaten und Design-Dateien; Beträge und
    Rechnungen bleiben (Aufbewahrungspflicht).
  - Nie bestellte Uploads (abgebrochene Warenkörbe) löscht `cleanup-designs`
    (älter als 30 Tage). Erst trocken testen, dann wöchentlich planen:

    ```bash
    curl -X POST https://<ref>.supabase.co/functions/v1/cleanup-designs \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      -H "Content-Type: application/json" -d '{"dryRun":true}'
    ```

    Planen: Dashboard → Integrations → Cron → Job „cleanup-designs“, wöchentlich
    (z. B. `30 3 * * 1`), Typ Edge Function `cleanup-designs`, POST, Body
    `{"dryRun":false}`, Header `Authorization: Bearer <service_role key>`.
  - Gespeicherte Checkout-Warenkörbe löscht `purge-checkout-carts` täglich nach 30 Tagen (pg_cron, §2.1).

## 5 · Edge Functions und Secrets

```bash
supabase functions deploy            # alle Functions; stripe-webhook ohne JWT-Prüfung (config.toml)
supabase secrets set --env-file supabase/.env.production   # gitignort
supabase secrets list                # zeigt nur Digests
```

| Secret | Pflicht | Zweck |
|---|---|---|
| `STRIPE_SECRET_KEY` | ja | `sk_live_…` (oder Restricted Key mit PaymentIntents + Refunds schreiben); create-payment-intent, create-order, stripe-webhook, refund-order |
| `STRIPE_WEBHOOK_SECRET` | ja | `whsec_…` des **Live**-Endpunkts (§6); ohne → jeder Webhook 400 |
| `RESEND_API_KEY` | ja | Bestell-, Versand-, Rechnungs-, Newsletter- und Admin-Mails |
| `ORDER_EMAIL_FROM` | ja | z. B. `Private Shirt <bestellung@private-shirt.de>` — Domain muss in Resend verifiziert sein (§9). Ohne → keine Mails (bewusst kein Fallback) |
| `ORDER_EMAIL_TO` | empfohlen | Postfach des Inhabers (neue Bestellungen, Alarme „Zahlung ohne Bestellung“, Kontakt/Großbestellung/Bewertung via `notify-admin`); sonst Admin → Einstellungen → Bestell-Postfach |
| `SITE_URL` | ja | `https://private-shirt.de` — Links in Mails (AGB/Widerruf, Newsletter-Bestätigung, Admin-Links) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | automatisch | von Supabase gesetzt, nicht selbst setzen |

Functions: `create-payment-intent`, `create-order`, `stripe-webhook`,
`refund-order`, `generate-invoice`, `send-invoice`, `send-ship-email`,
`newsletter`, `notify-admin`, `anonymize-order`, `cleanup-designs`.
Prüfen: `supabase functions list` → alle `ACTIVE`.

## 6 · Stripe: Test → Live

Alle drei Werte müssen aus **demselben Stripe-Konto und demselben Modus** stammen:
`VITE_STRIPE_PUBLISHABLE_KEY` (Netlify) ↔ `STRIPE_SECRET_KEY` (Supabase) ↔
`STRIPE_WEBHOOK_SECRET` (Supabase, gehört zum Endpunkt). `pk_live` + `sk_test`
→ jede Zahlung scheitert; Webhook nur im Testmodus → wer nach dem Bezahlen den
Tab schließt, bekommt **keine** Bestellung (das Geld liegt ohne Bestellung bei Stripe).

1. Konto aktiviert (Firmendaten, Bankkonto, Rechnungsdeskriptor „PRIVATE SHIRT“).
2. **Settings → Payment methods (Live):** Karten an. Apple Pay / Google Pay /
   Link brauchen **Settings → Payment method domains → `private-shirt.de`**
   (sonst erscheinen sie nicht). PayPal (PayPal-Business-Konto verknüpfen) und
   Klarna nach Wunsch aktivieren — dann in der Datenschutzerklärung nennen.
   Verzögerte Methoden (SEPA-Lastschrift, Überweisung) besser aus: die Bestellung
   entsteht erst, wenn das Geld da ist (Tage später, per Webhook).
3. **Developers → Webhooks (Live):** Endpunkt
   `https://<ref>.supabase.co/functions/v1/stripe-webhook`, Events
   **`payment_intent.succeeded`** (Bestellung anlegen), **`charge.refunded`**
   (Erstattungen aus dem Stripe-Dashboard in der Bestellung vermerken) und
   **`charge.dispute.created`** (Alarm + Prüfhinweis an der Bestellung bei
   Chargebacks) → Signing secret →
   `STRIPE_WEBHOOK_SECRET`. Die Function braucht dafür einen Key mit
   Lesezugriff auf Refunds.
4. `supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=…` (aus dem Passwortmanager einfügen, nicht in die Shell-History: besser `--env-file`).
5. Netlify → `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…` → **neu deployen** (der Key
   wird beim Build eingebaut; Env-Änderung allein wirkt nicht).
6. Den Secret Key, den der Altshop auf Netlify nutzt, beim Umstieg in Stripe
   **rollen** (Developers → API keys → Roll key) und den neuen nur in Supabase
   setzen — dann kann der Altshop sicher nicht mehr abbuchen (§10).
7. Alte Webhook-Endpunkte des Altshops (`…netlify.app/api/stripe-webhook`) löschen.

## 7 · Netlify

Drei Sites aus einem Repo:

| Site | Base directory | Konfiguration |
|---|---|---|
| Shop v2 (private-shirt.de) | `v2` | `v2/netlify.toml` |
| B2B-Portal | `ballina` | `ballina/netlify.toml`, `ballina/DEPLOY.md` |
| Altshop (privateshirt.netlify.app) | *(leer)* | Root-`netlify.toml` — wird abgeschaltet (§10) |

**Ohne Base directory baut Netlify den Altshop** — beim Anlegen/Umstellen der
v2-Site unbedingt `v2` eintragen.

Env-Variablen der v2-Site:

| Variable | Wert |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Legacy anon key (`eyJ…`, §1) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` zum Testen, zum Livegang `pk_live_…` |
| `SITE_URL` | optional, Basis-URL der Sitemap (Standard `https://private-shirt.de`) |

Keine Secrets auf Netlify (kein Service-Role-Key, kein `sk_…`): alles Geheime
liegt in Supabase. Der Build schreibt `public/sitemap.xml` aus den
veröffentlichten Produkten (DB muss beim Build erreichbar sein, sonst bleibt die alte Datei).

`v2/netlify.toml` enthält bereits:
- 301-Weiterleitungen der alten WordPress-URLs (aus `wp-sitemap.xml`, Okt. 2026):
  `/anfrage` → `/grossbestellung`, `/designer` → `/selbst-gestalten`,
  `/produkt` → `/produkte`, `/checkout*` → `/warenkorb`, `/mein-konto*`,
  `/registrieren`, `/passwort-vergessen`, Archivseiten → `/`, WooCommerce-Pfade
  (`/shop`, `/produkt-kategorie/*`) → `/produkte`; WordPress-Systempfade
  (`/wp-admin`, `/wp-content`, …) antworten mit echtem 404. Gleich gebliebene
  Seiten (`/impressum/`, `/produkte/`, …) brauchen keine Regel.
- Sicherheits-Header. Erzwungen nur `frame-ancestors 'none'; object-src 'none';
  base-uri 'self'; form-action 'self'`. Die vollständige CSP läuft als
  **`Content-Security-Policy-Report-Only`**: im Browser (DevTools → Konsole)
  Startseite mit Video, Designer (Upload, Export, In den Warenkorb), Kasse inkl.
  3-D-Secure-Testkarte und PayPal, Filialen-Karte nach Zustimmung und den Admin
  durchklicken. Keine Meldungen „[Report Only] Refused to …“ → Header in
  `Content-Security-Policy` umbenennen. Ändert sich das Inline-Script in
  `index.html`, muss sein `sha256-…` in der Policy angepasst werden. Bei
  eigener Supabase-Domain diese statt `*.supabase.co` eintragen.

Netlify setzt die netlify.app-Adresse automatisch per 301 auf die primäre
Domain um, sobald `private-shirt.de` primär ist; `www` ebenso. Vorschau-Hosts
(`*.netlify.app`) sind zusätzlich per `noindex` gesperrt.

## 8 · Testbestellungen

### 8.1 Staging (Testmodus) — vor der DNS-Umstellung

v2 unter `https://<site>.netlify.app` mit `pk_test`/`sk_test` und Test-Webhook:

- [ ] Produkt in den Warenkorb, Kasse mit `4242 4242 4242 4242` → Bestellbestätigung, Bestellnummer `PS-JJJJ-NNNNN`.
- [ ] 3-D Secure `4000 0027 6000 3184`, Ablehnung `4000 0000 0000 0002`, ggf. PayPal-Testzahlung.
- [ ] Designer: Text + Bild auf zwei Ansichten → Admin zeigt alle Dateien, „Design-Dateien (ZIP)“ enthält Druckdateien + `PRODUKTION.txt`.
- [ ] Tab direkt nach dem Bezahlen schließen → Bestellung entsteht trotzdem (Webhook, Stripe → Webhooks → Zustellung 200).
- [ ] Mails: Kunde (Bestätigung), Inhaber (neue Bestellung), Kontakt/Großbestellung/Bewertung (`notify-admin`), Newsletter-Double-Opt-in, Versandmail — in Resend → Logs prüfen.
- [ ] Admin: Status ändern, Versand mit Tracking, Erstattung (voll und teilweise) → Bestand zurück, Stornorechnung.
- [ ] Gutschein, Mengenrabatt, Versandkostenfrei-Grenze.
- [ ] Skripte (lokal, mit Test-Keys und Service-Role-Key in `v2/.env`, nie auf Netlify):
      `node scripts/test-purchase.mjs` und `node scripts/checks/<n>.mjs`.

**Rechnungsnummern sind fortlaufend und lückenlos (GoBD).** Im späteren
Live-Projekt keine Rechnungen für Testbestellungen erzeugen — oder Testdaten vor
dem Livegang löschen und den Zähler zurücksetzen, solange es noch keine echte Rechnung gibt.

### 8.2 Produktion (Live-Keys) — direkt nach dem Umschalten

1. Günstigstes Produkt, echte Karte, eigene Adresse.
2. Stripe → Zahlungen: „Erfolgreich“; Webhooks (Live): Zustellung `200`.
3. Admin → Bestellungen: Bestellung mit Nummer, ohne Badge „prüfen“
   (`review_reason`), ohne Mail-Warnsymbol (`email_sent`), Bestand reduziert.
4. Beide Mails angekommen (Resend → Logs: „Delivered“, nicht im Spam).
5. „Rechnung erstellen (PDF)“ und ansehen (Firmendaten, USt.).
6. Admin → Erstattung (refund-order) → Stripe zeigt Erstattung, Bestand wieder
   da, Stornorechnung erzeugt. Rechnung + Storno sind echte Belege — dem
   Steuerbüro als Testkauf melden.

## 9 · Domain und E-Mail (private-shirt.de)

Heute liegt private-shirt.de auf dem WordPress-Hosting; die Postfächer
`info@`, `europa-passage@`, `altona@private-shirt.de` laufen über die
bestehenden MX-Einträge. **Die Mail darf beim Umzug nicht ausfallen.**

1. **Vorher:** komplette DNS-Zone exportieren/fotografieren (A, AAAA, CNAME,
   MX, TXT/SPF, DKIM `*._domainkey`, `_dmarc`, autodiscover, SRV,
   Verifizierungs-TXT). TTL von A/CNAME einen Tag vorher auf 300 s senken.
2. **Nameserver nicht wechseln** (nicht auf Netlify-DNS umziehen), solange nicht
   alle Mail-Einträge 1:1 übernommen sind. Nur Web-Einträge ändern.
3. Netlify → v2-Site → Domain management: `private-shirt.de` (primär) und
   `www.private-shirt.de` hinzufügen.
4. Beim DNS-Anbieter: Apex-`A` → Netlify-Load-Balancer-IP aus der Netlify-Anzeige
   (derzeit `75.2.60.5`), alte `AAAA` des WordPress-Hosts **löschen**;
   `www` als `CNAME` → `<site>.netlify.app`. MX/TXT/DKIM unverändert lassen.
5. Netlify stellt das Let's-Encrypt-Zertifikat aus (Domain management → HTTPS,
   „Verify DNS configuration“). Danach `https://private-shirt.de` und
   `https://www.private-shirt.de` prüfen (www → 301 auf Apex).
6. **Resend:** Domain `private-shirt.de` hinzufügen → die angezeigten Einträge
   anlegen (DKIM-TXT `resend._domainkey`, MX + SPF-TXT auf der Subdomain `send`).
   Sie berühren die Haupt-MX/SPF nicht. Erst nach „Verified“ `ORDER_EMAIL_FROM`
   mit `@private-shirt.de` setzen. Bestehenden `_dmarc`-Eintrag beibehalten.
7. URLs umstellen: Secret `SITE_URL`, Auth Site URL + Redirect URLs (§3),
   Stripe Payment method domain (§6), Netlify-Test-URL aus den Redirect URLs entfernen.
8. Google Search Console: Domain-Property, `https://private-shirt.de/sitemap.xml`
   einreichen, in den ersten Wochen „Seiten“ → 404/Weiterleitungen beobachten.
9. **WordPress-Hosting nicht kündigen**, bevor geklärt ist, wo die Postfächer
   liegen (häufig im selben Vertrag). WordPress 30 Tage als Rückfall behalten.
   Rollback: A/CNAME auf die notierten alten Werte zurücksetzen.
10. Falls auch `private-shirt.com` registriert ist: als Domain-Alias in Netlify
    eintragen (leitet auf die primäre Domain).

## 10 · Altshop (privateshirt.netlify.app) abschalten

Der Altshop (Root-App, WooCommerce + Stripe) nimmt sonst weiter Zahlungen an;
diese Bestellungen landen in WooCommerce, wo niemand mehr nachsieht.

**Variante A (empfohlen):** Die bestehende Netlify-Site für v2 weiterverwenden:
Base directory `v2`, Env wie §7. Der Altshop ist damit weg, die netlify.app-URL
leitet auf private-shirt.de, alte Deploys bleiben als Notfall-Rollback.
**Variante B:** v2 als neue Site → Altshop-Site löschen oder per
Weiterleitung abschalten (Snippet im Root-`README.md`).

In beiden Fällen auf der Altshop-Site entfernen: `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `WC_*`, `SMTP_*`, `WP_EMAIL_*`, `CONTACT_EMAIL_TO`;
Stripe-Key rollen (§6) und alten Webhook löschen.

## 11 · Backups

Supabase-Backups enthalten **nur die Datenbank, keine Storage-Dateien**
(Druckdateien, Rechnungs-PDFs, Produktbilder).

- **Pro-Plan:** tägliche Backups (7 Tage). **PITR** (Add-on) für v2 aktivieren —
  Bestellungen und Rechnungsnummern.
- **Storage wöchentlich sichern** (Storage → S3 Connection → Access Key anlegen),
  z. B. mit rclone auf einen externen Speicher (NAS, Hetzner Storage Box, Backblaze):
  `rclone sync supabase:order-designs backup:private-shirt/order-designs` —
  ebenso `invoices` und `product-images`.
- **10 Jahre Aufbewahrung** (§ 147 AO / GoBD): monatlich `supabase db dump`
  (Schema + `--data-only`) und den Bucket `invoices` ins Archiv; die 7 Tage
  Supabase-Backups reichen dafür nicht.
- **Wiederherstellen:** Database → Backups → Restore bzw. PITR-Zeitpunkt
  (Projekt ist dabei kurz offline); Storage per `rclone sync` zurück. Einmal
  testweise in ein Zweitprojekt wiederherstellen und notieren, wie lange es dauert.
- ballina: gleiches Vorgehen für die Buckets `artwork` und `invoices` (`ballina/DEPLOY.md`).

## 12 · Monitoring

- **Uptime** (UptimeRobot oder Better Stack, kostenlos, Alarm per SMS/Mail an den Inhaber):
  1. `https://private-shirt.de/` → 200
  2. `GET https://<ref>.supabase.co/rest/v1/products?select=id&limit=1` mit Header
     `apikey: <anon key>` → 200 (fällt aus, wenn das Projekt pausiert — genau der heutige Fall)
  3. `POST https://<ref>.supabase.co/functions/v1/notify-admin` mit Header
     `Authorization: Bearer <anon key>`, Body `{}` → 200 (Edge Functions laufen; schickt keine Mail)
  4. Login-Seite des B2B-Portals → 200
- **Fehler:** Es gibt noch kein Error-Tracking (Sentry o. Ä.). Bis dahin:
  - Supabase → Edge Functions → Logs in der ersten Woche täglich ansehen
    (Filter `error`), v. a. `create-order`, `stripe-webhook`.
  - Stripe meldet fehlschlagende Webhooks per Mail; die Mail-Adresse im
    Stripe-Konto prüfen. `stripe-webhook` schickt bei „Zahlung ohne Bestellung“
    selbst einen Alarm an `ORDER_EMAIL_TO`.
  - Admin → Bestellungen: Badge „prüfen“ (`review_reason`) und Mail-Warnsymbol
    (Bestätigung nicht zugestellt) täglich ansehen.
  - Resend → Logs: Bounces/Fehler.

## 13 · Sicherheit und Altlasten

- **WooCommerce-Key rotieren (kritisch):** Der Live-Key (Lesen + Schreiben aller
  Bestellungen und Kunden) steht in der Git-Historie und war früher im
  Browser-Bundle; er wurde nie getauscht. WooCommerce → Einstellungen → Erweitert
  → REST-API → alten Key widerrufen; neuen **Read-only**-Key für ballina
  (`wc-proxy`) und die Import-Skripte; einen Read/Write-Key nur, solange der
  Altshop noch Bestellungen anlegt. Neue Werte in Netlify (ballina, ggf. Altshop)
  und lokale `.env`. Danach Hosting-Logs auf Zugriffe mit dem alten Key prüfen.
- GitHub-Repo privat halten, Secret Scanning aktivieren; optional die Historie
  bereinigen (`git filter-repo`, danach alle Klone neu ziehen) — ersetzt nicht das Rotieren.
- ballina: Seed-Passwörter und DB-Passwort rotieren (`ballina/DEPLOY.md` §5).
- Nur `.env.example` wird versioniert; `.env`, `.env.*`, `*.env` sind gitignort.
- Rechtstexte (Impressum, AGB, Datenschutz, Widerruf) vor dem Livegang prüfen
  lassen; aktivierte Zahlarten (PayPal, Klarna) und Dienstleister (Supabase,
  Netlify, Stripe, Resend, Google Maps) müssen in der Datenschutzerklärung stehen.
- Firmendaten auf Rechnungen (`supabase/functions/_shared/invoice.ts`, `COMPANY`)
  mit Handelsregister/USt-IdNr. abgleichen.
