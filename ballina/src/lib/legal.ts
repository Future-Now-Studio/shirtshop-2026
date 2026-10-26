import { FLAT_SHIPPING, FREE_SHIPPING_FROM, formatEUR } from './utils'

/**
 * Company and legal data of the portal operator — the ONE place to fill in
 * before go-live. Used by the legal pages (Impressum, Datenschutz, AGB,
 * Widerruf), the in-app footer links and the quote / invoice documents.
 *
 * Every value in «…» is a placeholder the owner must replace with real data.
 * The texts below are drafts that describe how the portal actually works;
 * they must be reviewed by a lawyer. Once everything is final, set
 * LEGAL_FINAL = true — until then the legal pages show a draft notice.
 */
export const LEGAL_FINAL = false

export const COMPANY = {
  /** Brand shown in the UI and on documents. */
  brand: 'Ballina',
  /** Legal name incl. legal form, e.g. "Ballina Textildruck GmbH". */
  legalName: '«Firmenname inkl. Rechtsform»',
  street: '«Straße Hausnummer»',
  zipCity: '«PLZ Ort»',
  country: 'Deutschland',
  /** Managing director(s) / owner (Vertretungsberechtigte). */
  representative: '«Vor- und Nachname der Geschäftsführung»',
  phone: '«Telefonnummer»',
  email: '«kontakt@ihre-domain.de»',
  /** Address for complaints (Reklamationen) outside the portal. */
  serviceEmail: '«service@ihre-domain.de»',
  /** Contact for data protection requests (or the DPO, if one is appointed). */
  privacyEmail: '«datenschutz@ihre-domain.de»',
  /** "Amtsgericht …, HRB …" — leave empty for a sole proprietorship. */
  register: '«Registergericht und Registernummer, z. B. Amtsgericht Dresden, HRB 12345»',
  vatId: '«USt-IdNr. DE…»',
  /** Competent data protection supervisory authority (Bundesland). */
  supervisoryAuthority: '«zuständige Landesdatenschutzbehörde»',
  /** Place of jurisdiction for B2B contracts. */
  jurisdiction: '«Sitz der Gesellschaft»',
}

/** False for an empty value or a «…» placeholder that has not been filled in yet. */
export function isFilled(value: string): boolean {
  return !!value.trim() && !value.includes('«')
}

/**
 * One-line sender for document footers. Placeholders are left out, so quote
 * and invoice documents never print «…» (the legal pages still show them).
 */
export const COMPANY_LINE = [
  COMPANY.legalName,
  isFilled(COMPANY.street) && isFilled(COMPANY.zipCity) ? `${COMPANY.street}, ${COMPANY.zipCity}` : '',
  COMPANY.register,
  isFilled(COMPANY.vatId) ? `USt-IdNr. ${COMPANY.vatId}` : '',
].filter(isFilled).join(' · ')

export type LegalDoc = 'impressum' | 'datenschutz' | 'agb' | 'widerruf'

export interface LegalSection {
  h?: string
  p: string
}

const SHIPPING_RULE = `Versand pauschal ${formatEUR(FLAT_SHIPPING)} netto je Bestellung; ab ${formatEUR(FREE_SHIPPING_FROM)} netto Warenwert versandkostenfrei.`

export const LEGAL_CONTENT: Record<LegalDoc, { title: string; body: LegalSection[] }> = {
  impressum: {
    title: 'Impressum',
    body: [
      { h: 'Angaben gemäß § 5 DDG', p: `${COMPANY.legalName}\n${COMPANY.street}\n${COMPANY.zipCity}\n${COMPANY.country}` },
      { h: 'Vertreten durch', p: COMPANY.representative },
      { h: 'Kontakt', p: `Telefon: ${COMPANY.phone}\nE-Mail: ${COMPANY.email}` },
      { h: 'Registereintrag', p: COMPANY.register },
      { h: 'Umsatzsteuer-ID', p: `Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${COMPANY.vatId}` },
      {
        h: 'Hinweis',
        p: 'Dieses Portal richtet sich ausschließlich an Geschäftskunden (Unternehmer im Sinne des § 14 BGB). Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir nicht verpflichtet und nicht bereit.',
      },
    ],
  },
  datenschutz: {
    title: 'Datenschutzerklärung',
    body: [
      {
        h: '1. Verantwortlicher',
        p: `${COMPANY.legalName}, ${COMPANY.street}, ${COMPANY.zipCity}\nE-Mail: ${COMPANY.privacyEmail} · Telefon: ${COMPANY.phone}`,
      },
      {
        h: '2. Welche Daten wir verarbeiten',
        p: 'Im Geschäftskunden-Portal verarbeiten wir Firmen- und Kontaktdaten (Firma, Ansprechpartner, E-Mail, Telefon, Rechnungs- und Lieferadresse, USt-IdNr.), Anmeldedaten (E-Mail-Adresse und Passwort, das nur als Hash gespeichert wird), Bestell-, Angebots- und Anfragedaten (Artikel, Mengen, Bestellzeichen, Wunschtermin, Anmerkungen, Reklamationen), von Ihnen hochgeladene Druckdateien sowie ein Änderungsprotokoll (wer hat wann welche Bestellung, welches Angebot oder welche Stammdaten geändert).',
      },
      {
        h: '3. Zwecke und Rechtsgrundlagen',
        p: 'Vertragsanbahnung und -abwicklung, d. h. Anfragen, Angebote, Bestellungen, Lieferung, Rechnungsstellung und Reklamationen (Art. 6 Abs. 1 lit. b DSGVO); Erfüllung handels- und steuerrechtlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO); Sicherheit und Nachvollziehbarkeit des Portals, z. B. Änderungsprotokoll und Schutz vor Missbrauch (Art. 6 Abs. 1 lit. f DSGVO).',
      },
      {
        h: '4. Empfänger und Auftragsverarbeiter',
        p: 'Wir setzen folgende Dienstleister im Rahmen von Verträgen zur Auftragsverarbeitung (Art. 28 DSGVO) ein:\n• Supabase Inc. – Datenbank, Anmeldung und Dateispeicher (Serverstandort: «Region des Supabase-Projekts, z. B. Frankfurt/EU»)\n• Netlify Inc. – Bereitstellung der Webanwendung und Serverfunktionen\n• Resend Inc. – Versand von E-Mails (Bestellbestätigungen, Statusmeldungen, Einladungs- und Passwort-Links)\nSoweit dabei Daten in die USA übermittelt werden, erfolgt dies auf Grundlage «des EU-US Data Privacy Framework bzw. der EU-Standardvertragsklauseln – vom Betreiber zu prüfen und zu ergänzen».',
      },
      {
        h: '5. Speicherung im Browser',
        p: 'Das Portal setzt keine Tracking- oder Marketing-Cookies und bindet keine Analyse-Dienste ein. Im Speicher Ihres Browsers (localStorage) werden nur technisch notwendige Daten abgelegt: Ihre Anmeldesitzung, damit Sie angemeldet bleiben, und ob Sie den Hinweis zur Speicherung bereits geschlossen haben (§ 25 Abs. 2 Nr. 2 TDDDG). Beim Abmelden wird die Sitzung entfernt.',
      },
      {
        h: '6. Speicherdauer',
        p: 'Wir speichern Ihre Daten, solange Ihr Kundenkonto besteht und es für die Vertragsabwicklung erforderlich ist. Bestell- und Rechnungsdaten bewahren wir entsprechend den gesetzlichen Fristen auf (je nach Unterlage 6, 8 oder 10 Jahre nach § 257 HGB, § 147 AO). «Löschfristen für Druckdateien, Anfragen und das Änderungsprotokoll vom Betreiber festzulegen.»',
      },
      {
        h: '7. Ihre Rechte',
        p: `Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Wenden Sie sich dazu an ${COMPANY.privacyEmail}. Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. bei ${COMPANY.supervisoryAuthority}.`,
      },
    ],
  },
  agb: {
    title: 'Allgemeine Geschäftsbedingungen',
    body: [
      {
        h: '§ 1 Geltungsbereich',
        p: `Diese AGB gelten für alle Verträge zwischen ${COMPANY.legalName} („${COMPANY.brand}“) und Unternehmern im Sinne des § 14 BGB, die über das Geschäftskunden-Portal geschlossen werden. Abweichende Bedingungen des Kunden gelten nur, wenn wir ihnen ausdrücklich zustimmen.`,
      },
      {
        h: '§ 2 Anfrage, Angebot und Vertragsschluss',
        p: 'Über das Portal können Sie eine unverbindliche Anfrage stellen. Unsere Angebote sind freibleibend und bis zum angegebenen Datum gültig. Mit „Angebot verbindlich annehmen“ im Portal geben Sie eine verbindliche Bestellung zu den Positionen und Preisen des Angebots ab. Bei Nachbestellungen geben Sie mit „Verbindlich nachbestellen“ ein verbindliches Angebot ab. Der Vertrag kommt jeweils mit unserer Auftragsbestätigung bzw. mit der Ausführung der Bestellung zustande.',
      },
      {
        h: '§ 3 Preise und Zahlung',
        p: `Es gelten die im Angebot bzw. die für Ihr Unternehmen hinterlegten Preise, jeweils netto zuzüglich der gesetzlichen Umsatzsteuer. ${SHIPPING_RULE} Bei Nachbestellungen mit neuen Artikeln, anderen Varianten oder geringeren Mengen sind die angezeigten Preise vorläufig und werden von uns vor der Produktion bestätigt. Die Zahlung erfolgt auf Rechnung innerhalb des vereinbarten Zahlungsziels.`,
      },
      {
        h: '§ 4 Druckdaten',
        p: 'Für die von Ihnen gelieferten Druckdaten und deren Rechte (z. B. Marken- und Urheberrechte an Logos) sind Sie verantwortlich. Wir prüfen Druckdaten nur auf offensichtliche Mängel.',
      },
      {
        h: '§ 5 Lieferung',
        p: 'Ein im Portal angegebener Wunschtermin ist unverbindlich, sofern wir ihn nicht ausdrücklich bestätigen. Lieferzeiten beginnen mit der Freigabe aller Druckdaten.',
      },
      {
        h: '§ 6 Mängel und Reklamationen',
        p: `Offensichtliche Mängel sind unverzüglich, spätestens innerhalb von «Frist, z. B. 7» Tagen nach Erhalt der Ware zu melden – am einfachsten über „Reklamation melden“ in der jeweiligen Bestellung oder an ${COMPANY.serviceEmail} (§ 377 HGB).`,
      },
      {
        h: '§ 7 Schlussbestimmungen',
        p: `Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist ${COMPANY.jurisdiction}.`,
      },
    ],
  },
  widerruf: {
    title: 'Widerruf & Rückgabe',
    body: [
      {
        h: 'Kein Widerrufsrecht für Unternehmer',
        p: 'Das Portal richtet sich ausschließlich an Unternehmer. Das gesetzliche Widerrufsrecht für Verbraucher findet keine Anwendung.',
      },
      {
        h: 'Individualanfertigungen',
        p: 'Textilien mit kundenindividuellem Druck oder Stick sind vom Umtausch ausgeschlossen, sofern kein Mangel vorliegt.',
      },
      {
        h: 'Stornierung und Reklamationen',
        p: `Solange eine Bestellung den Status „Offen“ hat, können Sie sie im Portal selbst stornieren. Mängel melden Sie bitte unverzüglich über „Reklamation melden“ in der Bestellung oder an ${COMPANY.serviceEmail}.`,
      },
    ],
  },
}
