import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

type Doc = 'impressum' | 'datenschutz' | 'agb' | 'widerruf'

const CONTENT: Record<Doc, { title: string; body: { h?: string; p: string }[] }> = {
  impressum: {
    title: 'Impressum',
    body: [
      { h: 'Angaben gemäß § 5 TMG', p: 'Ballina B2B Textildruck\nMusterstraße 1\n12345 Musterstadt' },
      { h: 'Vertreten durch', p: 'Geschäftsführung: Vorname Nachname' },
      { h: 'Kontakt', p: 'Telefon: +49 (0)000 000000\nE-Mail: kontakt@ballina.de' },
      { h: 'Registereintrag', p: 'Eintragung im Handelsregister.\nRegistergericht: Amtsgericht Musterstadt\nRegisternummer: HRB 00000' },
      { h: 'Umsatzsteuer-ID', p: 'USt-IdNr. gemäß § 27a UStG: DE 000 000 000' },
    ],
  },
  datenschutz: {
    title: 'Datenschutzerklärung',
    body: [
      { h: 'Verantwortlicher', p: 'Ballina B2B Textildruck, Musterstraße 1, 12345 Musterstadt.' },
      { h: 'Verarbeitung im Portal', p: 'Wir verarbeiten die zur Abwicklung Ihrer Bestellungen erforderlichen Daten (Firmen-, Kontakt-, Liefer- und Bestelldaten) auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO.' },
      { h: 'Hosting & Auftragsverarbeitung', p: 'Daten werden bei unseren Dienstleistern (u. a. Datenbank- und Hosting-Anbieter) im Rahmen von Auftragsverarbeitungsverträgen gespeichert.' },
      { h: 'Ihre Rechte', p: 'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Wenden Sie sich hierzu an datenschutz@ballina.de.' },
    ],
  },
  agb: {
    title: 'Allgemeine Geschäftsbedingungen',
    body: [
      { h: '§ 1 Geltungsbereich', p: 'Diese AGB gelten für alle Verträge zwischen Ballina und Unternehmern im Sinne des § 14 BGB über das B2B-Portal.' },
      { h: '§ 2 Vertragsschluss', p: 'Die Darstellung im Katalog ist kein bindendes Angebot. Mit Absenden einer Bestellung geben Sie ein verbindliches Angebot ab; der Vertrag kommt mit unserer Auftragsbestätigung zustande.' },
      { h: '§ 3 Preise & Zahlung', p: 'Es gelten die im Portal hinterlegten Firmenkonditionen (netto zzgl. USt.). Zahlung erfolgt auf Rechnung gemäß vereinbartem Zahlungsziel.' },
      { h: '§ 4 Druckdaten', p: 'Für vom Kunden gelieferte Druckdaten und Freigaben ist der Kunde verantwortlich. Wir prüfen Daten nur auf offensichtliche Mängel.' },
      { h: '§ 5 Lieferung', p: 'Lieferzeiten sind unverbindlich, sofern nicht ausdrücklich als verbindlich vereinbart.' },
    ],
  },
  widerruf: {
    title: 'Widerruf & Rückgabe',
    body: [
      { h: 'Kein Widerrufsrecht für Unternehmer', p: 'Das gesetzliche Widerrufsrecht für Verbraucher findet im B2B-Geschäft keine Anwendung.' },
      { h: 'Individualanfertigungen', p: 'Textilien mit kundenindividuellem Druck oder Stick sind vom Umtausch ausgeschlossen, sofern kein Mangel vorliegt.' },
      { h: 'Reklamationen', p: 'Mängel melden Sie bitte unverzüglich über die Bestellung im Portal (Funktion „Reklamation melden") oder an service@ballina.de.' },
    ],
  },
}

export default function Legal({ doc }: { doc: Doc }) {
  const { title, body } = CONTENT[doc]
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <BrandMark />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Startseite
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-8 space-y-6">
          {body.map((s, i) => (
            <section key={i}>
              {s.h && <h2 className="text-base font-semibold">{s.h}</h2>}
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.p}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Mustertexte – vor dem Livegang durch rechtsgeprüfte Fassungen ersetzen.
        </p>
      </main>
    </div>
  )
}
