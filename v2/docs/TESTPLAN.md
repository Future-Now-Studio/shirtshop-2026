# ShirtShop v2 — 50 Test Cases

Legend: ✅ pass · ❌ fail · 🔧 fixed

## A. Public shop
1. Home lädt ohne Konsolenfehler
2. Home zeigt Hero-Video + Trust-Bar (3 Stats)
3. Home zeigt Highlights-Slider mit Produkten
4. Home zeigt Shop-Bento (3 Kacheln)
5. Home zeigt FAQ-Akkordeon (Details aufklappbar)
6. Home zeigt Filialen-Sektion (2 Stores)
7. /produkte lädt alle 21 veröffentlichten Produkte
8. Kategorie-Filter zeigt nur saubere Kategorien (Accessoires/Baby/Hoodies/Polos/T-Shirts)
9. Kategorie-Filter filtert korrekt (Klick reduziert Karten)
10. Produktkarte verlinkt auf /produkt/:slug
11. Produktbild in Karte: object-contain auf weiß (quadratisch)

## B. Produktdetail
12. Detailseite lädt Produkt (Name, Preis, Beschreibung)
13. Farb-Swatches werden angezeigt (>1 Farbe)
14. Farbwechsel wechselt das Galeriebild
15. Ansichts-Tabs (vorne/hinten/links/rechts) schalten Bild
16. Größen-Mengen-Matrix vorhanden (Stepper je Größe)
17. Ausverkaufte Größe (stock 0) ist deaktiviert
18. „In den Warenkorb" erst aktiv bei Menge > 0
19. Add-to-Cart erzeugt Position pro Größe

## C. Creator / Designer
20. /gestalten/:slug lädt, Canvas rendert
21. Garment-Bild auf Canvas sichtbar (weißer BG)
22. Text hinzufügen → Element erscheint, Preis steigt
23. Bild hinzufügen (Upload) funktioniert
24. Element löschen funktioniert
25. Farbwechsel wechselt Canvas-Bild + zeigt Ladeindikator
26. Ansichten-Thumbnails wechseln View
27. Motiv außerhalb Druckzone → Warnung erscheint
28. Step 1 → Step 2 Umschaltung (weiter-Button)
29. Größen-Matrix in Step 2 (Menge je Größe)
30. Add-to-Cart aus Creator → Warenkorb, Positionen je Größe

## D. Warenkorb
31. Warenkorb zeigt Positionen mit Farbe/Größe/Menge
32. Mengen-Änderung aktualisiert Zeilensumme + Gesamt
33. Position löschen entfernt Zeile
34. Mengenrabatt greift ab Schwelle (min_qty)
35. Header-Badge zählt Gesamtmenge
36. Leerer Warenkorb zeigt Hinweis

## E. Checkout
37. /kasse zeigt Kundenformular (nicht „nicht konfiguriert")
38. Pflichtfelder erforderlich
39. „weiter zur zahlung" → PaymentIntent + Stripe-Element rendert
40. Bestellbestätigung zeigt Zusammenfassung (nach Zahlung)

## F. Admin
41. /admin ohne Login → Login-Maske
42. Admin-Nav zeigt alle Punkte (inkl. Bestellungen, Nachrichten)
43. Farben-CRUD lädt (Liste)
44. Produkte-Liste lädt mit Varianten-Anzahl
45. Bestellungen-Seite lädt (Liste)
46. Rabatte-Seite lädt

## G. Backend / Daten / RLS
47. Anon liest nur published Produkte (kein Draft)
48. Anon kann keine Produkte schreiben (RLS)
49. Anon kann keine Orders lesen (RLS)
50. create-payment-intent liefert clientSecret (Function live)

## Ergebnisse (durchgeführt 2026-07-06)

| Gruppe | Ergebnis |
|---|---|
| A Public shop (1–11) | ✅ alle (1 🔧 ErrorBoundary ergänzt) |
| B Detail (12–19) | ✅ alle |
| C Creator (20–30) | ✅ 20,22,24,25,26,28,29,30; 21 visuell ✅; 23 (Upload) + 27 (Zonen-Warnung) implementiert, manuell zu prüfen |
| D Warenkorb (31–36) | ✅ alle |
| E Checkout (37–40) | ✅ (Stripe live, PaymentElement rendert) |
| F Admin (41–46) | 41 ✅ Login-Gate; 42–46 hinter Login (vom Betreiber bestätigt) |
| G Backend/RLS/Fn (47–50) | ✅ alle |

**Gefundene Fehler & Fix:**
- Fehlende globale Error-Boundary → bei Backend-Ausfall crashte die ganze App (weißer Bildschirm). 🔧 `ErrorBoundary` ergänzt, umschließt alle Routen, zeigt „neu laden".

Rest: keine funktionalen Fehler. Nicht-automatisierbar (manuell/visuell): Bild-Upload im Creator, Motiv-außerhalb-Zone-Warnung, Admin-CRUD hinter Login.
