import { Fragment, useEffect, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Info,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Mail,
  MailX,
  Pencil,
  PlayCircle,
  Plus,
  Printer,
  RefreshCw,
  Route,
  ScrollText,
  Send,
  ShieldCheck,
  ShoppingBag,
  Undo2,
  UserCog,
  Wallet,
} from 'lucide-react'
import { berlinYear, cn, FLAT_SHIPPING, formatEUR, FREE_SHIPPING_FROM, NEXT_STATUS } from '@/lib/utils'
import type { OrderStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A label exactly as it appears in the back office (button, field, filter). */
function Ui({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-muted/60 px-1.5 py-px text-[0.85em] font-medium text-foreground">
      {children}
    </span>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
}

interface MockButton {
  label: string
  variant?: 'brand' | 'outline' | 'destructive'
  icon?: LucideIcon
}

/** Non-interactive copy of a real button, so staff recognise it on the page. */
function ButtonMock({ label, variant = 'outline', icon: Icon }: MockButton) {
  return (
    <span className={cn(buttonVariants({ variant, size: 'sm' }), 'pointer-events-none cursor-default')}>
      {Icon && <Icon className="size-3.5" />}
      {label}
    </span>
  )
}

/** Non-interactive copy of a filter pill (first one shown as selected). */
function FilterMock({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium',
        active ? 'border-brand bg-brand-muted text-brand' : 'border-border bg-background text-muted-foreground',
      )}
    >
      {label}
    </span>
  )
}

type CalloutKind = 'tip' | 'warning' | 'info'

const CALLOUT: Record<CalloutKind, { icon: LucideIcon; title: string; box: string; iconClass: string }> = {
  tip: { icon: Lightbulb, title: 'Tipp', box: 'border-brand/25 bg-brand-muted/60', iconClass: 'text-brand' },
  warning: {
    icon: AlertTriangle,
    title: 'Achtung',
    box: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100',
    iconClass: 'text-amber-600',
  },
  info: { icon: Info, title: 'Gut zu wissen', box: 'border-border bg-muted/40', iconClass: 'text-muted-foreground' },
}

interface Callout {
  kind: CalloutKind
  text: ReactNode
}

function CalloutBox({ kind, text }: Callout) {
  const c = CALLOUT[kind]
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3.5 text-sm', c.box)}>
      <c.icon className={cn('mt-0.5 size-4 shrink-0', c.iconClass)} />
      <div className="min-w-0 leading-relaxed">
        <span className="font-semibold">{c.title}: </span>
        {text}
      </div>
    </div>
  )
}

interface StepList {
  title: string
  items: ReactNode[]
}

function Steps({ title, items }: StepList) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5 leading-relaxed">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Chips connected by arrows: a row on wide screens, a column on phones. */
function Flow({ nodes, links = [] }: { nodes: ReactNode[]; links?: ('one' | 'both')[] }) {
  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      {nodes.map((node, i) => {
        const Arrow = links[i - 1] === 'both' ? ArrowLeftRight : ArrowRight
        return (
          <Fragment key={i}>
            {i > 0 && <Arrow aria-hidden className="ml-3 size-4 shrink-0 rotate-90 text-muted-foreground sm:ml-0 sm:rotate-0" />}
            {node}
          </Fragment>
        )
      })}
    </div>
  )
}

/** Neutral step box used inside flows. */
function Pill({ icon: Icon, children, tone = 'default' }: { icon?: LucideIcon; children: ReactNode; tone?: 'default' | 'mail' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium',
        tone === 'mail' ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-background',
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      {children}
    </span>
  )
}

function MailTag({ name, to }: { name: string; to: string }) {
  return (
    <span className="inline-flex max-w-full items-start gap-1.5 rounded-lg bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Mail className="mt-px size-3.5 shrink-0" />
      <span>
        „{name}“ → {to}
      </span>
    </span>
  )
}

function NoMailTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <MailX className="size-3.5 shrink-0" /> Keine E-Mail
    </span>
  )
}

function Diagram({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="rounded-lg border border-border bg-muted/20 p-4">
      <figcaption className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</figcaption>
      {children}
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------

interface WorkflowStep {
  title: string
  who: 'Kunde' | 'Backoffice'
  text: ReactNode
  mails: { name: string; to: string }[]
  optional?: string
}

const WORKFLOW: WorkflowStep[] = [
  {
    title: 'Anfrage',
    who: 'Kunde',
    text: 'Der Kunde sendet im Portal eine Großanfrage (Produkt, Menge, Wunschtermin, optional eine Druckdatei).',
    mails: [{ name: 'Neue Großanfrage', to: 'Backoffice' }],
  },
  {
    title: 'Angebot',
    who: 'Backoffice',
    text: (
      <>
        Unter Anfragen <Ui>Angebot erstellen</Ui>, Preise eintragen und <Ui>Angebot senden</Ui>. Die Anfrage
        springt automatisch auf „Angebot gesendet“.
      </>
    ),
    mails: [
      { name: 'Neues Angebot', to: 'Kunde' },
      { name: 'Angebots-Erinnerung', to: 'Kunde, 3 Tage vor Ablauf' },
    ],
  },
  {
    title: 'Bestellung',
    who: 'Kunde',
    text: (
      <>
        Der Kunde nimmt das Angebot im Portal an (<Ui>Annehmen &amp; bestellen …</Ui>). Daraus entsteht automatisch
        eine Bestellung im Status „Offen“ mit den Angebotspreisen.
      </>
    ),
    mails: [{ name: 'Bestellbestätigung', to: 'Kunde + Kopie ans Backoffice' }],
  },
  {
    title: 'Preise bestätigen',
    who: 'Backoffice',
    optional: 'nur bei „Preise unbestätigt“',
    text: (
      <>
        Nur nötig, wenn die Bestellung vorläufige Preise hat (typisch: Nachbestellung mit neuem Artikel, anderer
        Variante oder kleinerer Menge). Bestellungen aus Angeboten sind bereits bestätigt.
      </>
    ),
    mails: [{ name: 'Preise bestätigt', to: 'Kunde' }],
  },
  {
    title: 'In Bearbeitung',
    who: 'Backoffice',
    text: 'Status „In Bearbeitung“ setzen, sobald die Produktion läuft. Der Kunde sieht den Schritt im Verlauf.',
    mails: [],
  },
  {
    title: 'Versendet',
    who: 'Backoffice',
    text: 'Versanddienst, Sendungsnummer und Tracking-Link eintragen und mit Status „Versendet“ speichern. Ändern Sie die Sendungsdaten danach, wird der Kunde erneut kurz informiert.',
    mails: [
      { name: 'Versandt', to: 'Kunde, mit Sendungsnummer' },
      { name: 'Sendungsverfolgung aktualisiert', to: 'Kunde, nur bei späterer Änderung' },
    ],
  },
  {
    title: 'Abgeschlossen',
    who: 'Backoffice',
    text: 'Nach der Zustellung abschließen. Danach ist kein Statuswechsel mehr möglich.',
    mails: [],
  },
]

function WorkflowDiagram() {
  return (
    <div className="space-y-4">
      <Diagram title="Auf einen Blick">
        <Flow
          nodes={WORKFLOW.map((s) => (
            <span
              key={s.title}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium',
                s.optional ? 'border-dashed border-amber-400 text-amber-700 dark:text-amber-300' : 'border-brand/30 bg-brand-muted text-brand',
              )}
            >
              {s.title}
            </span>
          ))}
        />
      </Diagram>

      <ol className="relative space-y-3">
        <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-px bg-border" />
        {WORKFLOW.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 sm:gap-4">
            <span
              className={cn(
                'z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 bg-background text-sm font-semibold',
                s.optional ? 'border-dashed border-amber-400 text-amber-700 dark:text-amber-300' : 'border-brand text-brand',
              )}
            >
              {i + 1}
            </span>
            <div className={cn('min-w-0 flex-1 rounded-lg border p-3', s.optional ? 'border-dashed border-amber-300' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.title}</span>
                <Badge variant={s.who === 'Kunde' ? 'info' : 'brand'}>{s.who}</Badge>
                {s.optional && <Badge variant="warning">{s.optional}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {s.mails.length ? s.mails.map((m) => <MailTag key={m.name} {...m} />) : <NoMailTag />}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

const KPI_HELP: { label: string; icon: LucideIcon; alert?: boolean; text: string }[] = [
  { label: 'Preise unbestätigt', icon: AlertTriangle, alert: true, text: 'Nicht stornierte Bestellungen mit vorläufigen Preisen, die Sie noch bestätigen müssen.' },
  { label: 'Offene Reklamationen', icon: AlertTriangle, alert: true, text: 'Bestellungen mit Reklamation, deren Bearbeitung noch nicht „Erledigt“ ist.' },
  { label: 'Neue Anfragen', icon: FileText, text: 'Großanfragen im Status „Neu“, die noch niemand bearbeitet hat.' },
  { label: 'Offene Angebote', icon: FileCheck2, text: 'Offene Angebote, deren Gültigkeit noch nicht abgelaufen ist.' },
  { label: 'Offene Bestellungen', icon: ShoppingBag, text: 'Bestellungen im Status „Offen“.' },
  { label: 'In Bearbeitung', icon: ShoppingBag, text: 'Bestellungen im Status „In Bearbeitung“.' },
  {
    label: `Auftragswert ${berlinYear()} (netto)`,
    icon: Wallet,
    text: 'Warenwert + Versand aller Bestellungen des laufenden Kalenderjahres – ohne Stornos und ohne unbestätigte Preise.',
  },
  { label: 'Kunden', icon: Building2, text: 'Anzahl aller angelegten Kunden.' },
]

function DashboardDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_HELP.map(({ label, icon: Icon, alert, text }) => (
        <div key={label} className={cn('rounded-xl border bg-card p-4', alert ? 'border-amber-300' : 'border-border')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            <div
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-lg',
                alert ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  )
}

function CustomerDiagram() {
  return (
    <Diagram title="Vom neuen Kunden zum ersten Login">
      <Flow
        nodes={[
          <Pill key="a" icon={Plus}>Neuer Kunde</Pill>,
          <Pill key="b" icon={Building2}>Kunde anlegen</Pill>,
          <Pill key="c" icon={UserCog}>Kd-Nr. + Login werden erstellt</Pill>,
          <Pill key="d" icon={Mail} tone="mail">Einladungs-Mail an den Kunden</Pill>,
          <Pill key="e" icon={KeyRound}>Kunde setzt sein Passwort</Pill>,
          <Pill key="f" icon={Check}>Kunde meldet sich an</Pill>,
        ]}
      />
    </Diagram>
  )
}

function InquiryDiagram() {
  return (
    <Diagram title="Status einer Anfrage">
      <Flow
        nodes={[
          <Badge key="n" variant="info">Neu</Badge>,
          <Badge key="i" variant="warning">In Bearbeitung</Badge>,
          <Badge key="a" variant="success">Angebot gesendet</Badge>,
          <Badge key="d" variant="neutral">Abgeschlossen</Badge>,
        ]}
      />
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Neu</dt>
          <dd className="text-muted-foreground">Der Kunde hat die Anfrage gesendet.</dd>
        </div>
        <div>
          <dt className="font-medium">In Bearbeitung</dt>
          <dd className="text-muted-foreground">
            Sie klicken <Ui>In Bearbeitung</Ui> (nur bei neuen Anfragen).
          </dd>
        </div>
        <div>
          <dt className="font-medium">Angebot gesendet</dt>
          <dd className="text-muted-foreground">
            Automatisch, sobald Sie über <Ui>Angebot erstellen</Ui> ein Angebot senden.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Abgeschlossen</dt>
          <dd className="text-muted-foreground">
            Sie klicken <Ui>Als erledigt</Ui> – aus jedem anderen Status möglich.
          </dd>
        </div>
      </dl>
    </Diagram>
  )
}

const QUOTE_OUTCOMES: { badge: ReactNode; title: string; text: ReactNode; mail?: { name: string; to: string } }[] = [
  {
    badge: <Badge variant="success">Angenommen</Badge>,
    title: 'Kunde nimmt an',
    text: (
      <>
        Kunde klickt <Ui>Annehmen &amp; bestellen …</Ui>. Die Bestellung wird automatisch angelegt (Status „Offen“,
        Preise bestätigt). Im Angebot erscheint <Ui>Zur Bestellung</Ui>.
      </>
    ),
    mail: { name: 'Bestellbestätigung', to: 'Kunde + Backoffice' },
  },
  {
    badge: <Badge variant="destructive">Abgelehnt</Badge>,
    title: 'Kunde lehnt ab',
    text: (
      <>
        Kunde klickt <Ui>Ablehnen</Ui>. Das Angebot ist damit abgeschlossen.
      </>
    ),
  },
  {
    badge: <Badge variant="neutral">Abgelaufen</Badge>,
    title: 'Gültigkeit endet',
    text: 'Ist „Gültig bis“ überschritten, wird das Angebot nachts automatisch auf „Abgelaufen“ gesetzt.',
  },
  {
    badge: <Badge variant="neutral">Zurückgezogen</Badge>,
    title: 'Sie ziehen zurück',
    text: (
      <>
        Sie klicken <Ui>Zurückziehen</Ui>. Der Kunde kann das Angebot danach nicht mehr annehmen.
      </>
    ),
  },
]

function QuoteDiagram() {
  return (
    <Diagram title="Lebenszyklus eines Angebots">
      <Flow
        nodes={[
          <Pill key="a" icon={Send}>Angebot senden</Pill>,
          <Pill key="b" icon={Mail} tone="mail">„Neues Angebot“ an den Kunden</Pill>,
          <Badge key="c" variant="info">Offen</Badge>,
        ]}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Solange es offen ist: <Ui>Bearbeiten</Ui> (ohne neue E-Mail) · automatische Erinnerungs-Mail 3 Tage vor Ablauf
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ArrowRight aria-hidden className="size-4 rotate-90" /> endet auf eine von vier Arten
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {QUOTE_OUTCOMES.map((o) => (
          <div key={o.title} className="rounded-lg border border-border bg-background p-3">
            {o.badge}
            <p className="mt-2 text-sm font-medium">{o.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{o.text}</p>
            <div className="mt-2">{o.mail ? <MailTag {...o.mail} /> : <NoMailTag />}</div>
          </div>
        ))}
      </div>
    </Diagram>
  )
}

const ORDER_STATUSES: OrderStatus[] = ['offen', 'in_bearbeitung', 'versendet', 'abgeschlossen', 'storniert']

function OrderDiagram() {
  return (
    <div className="space-y-4">
      <Diagram title="Status einer Bestellung">
        <Flow
          links={['both', 'one', 'one']}
          nodes={[
            <StatusBadge key="o" status="offen" />,
            <StatusBadge key="i" status="in_bearbeitung" />,
            <StatusBadge key="v" status="versendet" />,
            <StatusBadge key="a" status="abgeschlossen" />,
          ]}
        />
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex flex-wrap items-center gap-2">
            <span>Abkürzung:</span>
            <StatusBadge status="offen" />
            <ArrowRight aria-hidden className="size-3.5" />
            <StatusBadge status="versendet" />
            <span>ist direkt möglich.</span>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span>Abbruch:</span>
            <StatusBadge status="offen" />
            <span>oder</span>
            <StatusBadge status="in_bearbeitung" />
            <ArrowRight aria-hidden className="size-3.5" />
            <StatusBadge status="storniert" />
            <span>(endgültig).</span>
          </p>
        </div>
      </Diagram>

      <Diagram title="Erlaubte Statuswechsel">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="hidden grid-cols-[10rem_1fr] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Aktueller Status</span>
            <span>Wechsel möglich nach</span>
          </div>
          <div className="divide-y divide-border">
            {ORDER_STATUSES.map((s) => {
              const next = (NEXT_STATUS[s] ?? []) as OrderStatus[]
              return (
                <div key={s} className="grid gap-2 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
                  <div>
                    <StatusBadge status={s} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {next.length ? (
                      <>
                        <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                        {next.map((n, i) => (
                          <span key={n} className="inline-flex items-center gap-2">
                            {i > 0 && <span className="text-xs text-muted-foreground">oder</span>}
                            <StatusBadge status={n} />
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Endstatus – keine Änderung mehr möglich</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Nicht erlaubte Wechsel sind auf der Bestellseite ausgegraut. Bei „Preise unbestätigt“ sind „Versendet“ und
          „Abgeschlossen“ gesperrt, bis die Preise bestätigt sind.
        </p>
      </Diagram>

      <Diagram title="Reklamation – eigener Bearbeitungsstatus">
        <Flow
          nodes={[
            <Pill key="k" icon={AlertTriangle}>Kunde meldet Reklamation</Pill>,
            <Badge key="o" variant="destructive">Offen</Badge>,
            <Badge key="i" variant="destructive">In Bearbeitung</Badge>,
            <Badge key="e" variant="neutral">Erledigt</Badge>,
          ]}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Nur bei Bestellungen im Status „Versendet“ oder „Abgeschlossen“ und nur einmal je Bestellung. Der
          Bestellstatus selbst ändert sich dabei nicht – die Reklamation läuft daneben.
        </p>
      </Diagram>
    </div>
  )
}

const AUDIT_ACTIONS: [string, string][] = [
  ['kunde.angelegt', 'Kunde im Backoffice angelegt (inkl. Einladung)'],
  ['kunde.einladung', 'Einladung erneut gesendet'],
  ['kunde.aktualisiert', 'Konditionen oder Stammdaten geändert'],
  ['kunde.profil / kunde.lieferadresse', 'Kunde hat unter „Mein Konto“ Profil bzw. Lieferadresse geändert'],
  ['anfrage.eingegangen / anfrage.status', 'Großanfrage eingegangen bzw. Status geändert'],
  ['angebot.gesendet / angebot.geaendert', 'Angebot gesendet bzw. bearbeitet'],
  ['angebot.zurueckgezogen', 'Angebot vom Backoffice zurückgezogen'],
  ['angebot.angenommen / angebot.abgelehnt', 'Entscheidung des Kunden'],
  ['bestellung.angelegt', 'Bestellung vom Kunden oder manuell im Backoffice angelegt'],
  ['bestellung.preise_bestaetigt', 'Vorläufige Preise bestätigt'],
  ['bestellung.status', 'Statuswechsel durch das Backoffice'],
  ['bestellung.sendung', 'Versanddienst, Sendungsnummer oder Tracking-Link geändert'],
  ['bestellung.storniert', 'Vom Kunden storniert'],
  ['bestellung.reklamation / …_status', 'Reklamation gemeldet bzw. Bearbeitungsstatus geändert'],
  ['rechnung.angehängt', 'Dokument (PDF) an eine Bestellung angehängt'],
  ['admin.ernannt / admin.entfernt', 'Backoffice-Zugang vergeben oder entzogen'],
]

function AuditDiagram() {
  return (
    <Diagram title="Was im Audit-Log steht (Spalte „Aktion“)">
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {AUDIT_ACTIONS.map(([code, text]) => (
          <div key={code} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[18rem_1fr] sm:gap-4">
            <span className="break-words font-mono text-xs text-brand">{code}</span>
            <span className="text-muted-foreground">{text}</span>
          </div>
        ))}
      </div>
    </Diagram>
  )
}

const MAILS: { event: string; trigger: ReactNode; to: string }[] = [
  {
    event: 'Bestellbestätigung',
    trigger: (
      <>
        Kunde bestellt oder nimmt ein Angebot an – oder Sie legen eine Bestellung mit{' '}
        <Ui>Bestellbestätigung per E-Mail an den Kunden senden</Ui> an
      </>
    ),
    to: 'Kunde; Kopie ans Backoffice nur bei Kundenaktion',
  },
  { event: 'Preise bestätigt', trigger: <>Sie klicken <Ui>Preise bestätigen</Ui></>, to: 'Kunde' },
  {
    event: 'Versandt',
    trigger: (
      <>
        Sie speichern den Status „Versendet“ (mit Sendungsnummer, falls eingetragen) – oder legen eine Bestellung direkt
        als „Versendet“ mit <Ui>Bestellbestätigung und Versand-Mail an den Kunden senden</Ui> an (kommt nach der
        Bestellbestätigung)
      </>
    ),
    to: 'Kunde',
  },
  {
    event: 'Sendungsverfolgung aktualisiert',
    trigger:
      'Sie ändern Versanddienst oder Sendungsnummer einer versendeten Bestellung, nachdem die Versand-Mail raus ist – einmal je neuer Sendungsnummer',
    to: 'Kunde (neue Sendungsnummer, Tracking-Link)',
  },
  { event: 'Storno', trigger: 'Kunde storniert oder Sie speichern den Status „Storniert“', to: 'Kunde; Kopie ans Backoffice nur bei Kundenaktion' },
  { event: 'Reklamation', trigger: 'Kunde meldet eine Reklamation', to: 'Kunde; Kopie ans Backoffice' },
  { event: 'Neues Angebot', trigger: <>Sie klicken <Ui>Angebot senden</Ui></>, to: 'Kunde (Nummer, Positionen, gültig bis, Link)' },
  { event: 'Angebots-Erinnerung', trigger: 'Täglich morgens, wenn ein offenes Angebot in höchstens 3 Tagen abläuft', to: 'Kunde' },
  { event: 'Neue Großanfrage', trigger: 'Kunde sendet eine Anfrage', to: 'Backoffice' },
  {
    event: 'Einladung',
    trigger: (
      <>
        Sie klicken <Ui>Kunde anlegen</Ui> oder beim Kunden <Ui>Einladung erneut senden</Ui>
      </>
    ),
    to: 'Kunde (Link zum Passwort setzen)',
  },
  { event: 'Passwort zurücksetzen', trigger: <>Kunde klickt auf der Login-Seite <Ui>Passwort vergessen?</Ui></>, to: 'Kunde' },
]

function MailDiagram() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[11rem_1fr_14rem] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
          <span>E-Mail</span>
          <span>Wann?</span>
          <span>An wen?</span>
        </div>
        <div className="divide-y divide-border">
          {MAILS.map((m) => (
            <div key={m.event} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[11rem_1fr_14rem] md:gap-4">
              <span className="inline-flex items-start gap-1.5 font-medium">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-primary" /> {m.event}
              </span>
              <span className="text-muted-foreground">{m.trigger}</span>
              <span>{m.to}</span>
            </div>
          ))}
        </div>
      </div>
      <Diagram title="Hier geht keine E-Mail raus">
        <ul className="grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {[
            'Status „In Bearbeitung“, „Offen“ oder „Abgeschlossen“',
            'Nur den Tracking-Link ändern, Sendungsnummer löschen oder Sendungsdaten vor „Versendet“ eintragen',
            'Lieferschein drucken',
            'Angebot bearbeiten oder zurückziehen',
            'Angebot abgelehnt oder abgelaufen',
            'Reklamationsstatus ändern',
            'Dokument (PDF) anhängen oder ersetzen',
            'Anfrage-Status ändern',
            'Kundendaten oder interne Notizen speichern',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <MailX className="mt-0.5 size-3.5 shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </Diagram>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

interface GuideSection {
  id: string
  title: string
  short: string
  icon: LucideIcon
  why: ReactNode
  to?: { href: string; label: string }
  Visual?: ComponentType
  steps?: StepList[]
  filters?: string[]
  buttons?: MockButton[]
  callouts?: Callout[]
}

const SECTIONS: GuideSection[] = [
  {
    id: 'ablauf',
    title: 'Der typische Ablauf',
    short: 'Von der Anfrage bis zur abgeschlossenen Bestellung – mit allen E-Mails.',
    icon: Route,
    why: 'Zeigt, wie Anfragen, Angebote und Bestellungen zusammenhängen und wann der Kunde automatisch informiert wird.',
    to: { href: '/admin/anfragen', label: 'Anfragen' },
    Visual: WorkflowDiagram,
    callouts: [
      {
        kind: 'info',
        text: 'Kunden können auch ohne Anfrage direkt im Portal nachbestellen, und Sie können Bestellungen manuell anlegen. Dann beginnt der Ablauf bei Schritt 3.',
      },
    ],
  },
  {
    id: 'uebersicht',
    title: 'Übersicht',
    short: 'Kennzahlen auf einen Blick – was heute zu tun ist.',
    icon: LayoutDashboard,
    why: 'Die Startseite des Backoffice zeigt, wo gerade Arbeit wartet.',
    to: { href: '/admin', label: 'Übersicht' },
    Visual: DashboardDiagram,
    steps: [
      {
        title: "So geht's",
        items: [
          'Starten Sie den Tag auf der Übersicht. Gelb umrandete Kacheln brauchen Ihre Aufmerksamkeit.',
          'Klicken Sie auf eine Kachel – Sie landen direkt in der passend gefilterten Liste (z. B. Bestellungen mit Filter „Preise unbestätigt“).',
          'Die Zahlen in der Navigation links zeigen dasselbe: bei Anfragen die neuen Anfragen, bei Bestellungen „Preise unbestätigt“ plus offene Reklamationen.',
        ],
      },
    ],
    callouts: [
      {
        kind: 'tip',
        text: (
          <>
            Lassen sich die Kennzahlen nicht laden, klicken Sie <Ui>Erneut versuchen</Ui>.
          </>
        ),
      },
    ],
  },
  {
    id: 'kunden',
    title: 'Kunden',
    short: 'Firmen anlegen, Zugang einladen, Konditionen und Notizen pflegen.',
    icon: Building2,
    why: 'Hier verwalten Sie alle Geschäftskunden – Stammdaten, Konditionen und den Login fürs Portal.',
    to: { href: '/admin/kunden', label: 'Kunden' },
    Visual: CustomerDiagram,
    steps: [
      {
        title: 'Neuen Kunden anlegen',
        items: [
          <>
            Unter Kunden auf <Ui>Neuer Kunde</Ui> klicken.
          </>,
          <>
            <Ui>Firma</Ui>, <Ui>Ansprechpartner</Ui>, optional <Ui>Telefon</Ui> und die <Ui>E-Mail (Login)</Ui> eintragen.
          </>,
          <>
            <Ui>Rabatt (%) – Richtwert</Ui> (0–100, interner Richtwert für Angebote) und <Ui>Zahlungsziel</Ui>{' '}
            (vorbelegt mit „14 Tage netto“) prüfen.
          </>,
          <>
            <Ui>Kunde anlegen</Ui> klicken. Die Kundennummer wird automatisch vergeben, der Login erstellt und die
            Einladung zum Passwort setzen verschickt.
          </>,
        ],
      },
      {
        title: 'Kunden bearbeiten',
        items: [
          <>
            In der Liste suchen (Firma, Kd-Nr., Ansprechpartner oder Ort) und <Ui>Details</Ui> öffnen.
          </>,
          <>
            Firmenname, <Ui>Rabatt (%) – Richtwert</Ui>, <Ui>Jahresbudget (€ netto)</Ui>, Zahlungsziel, Ansprechpartner,
            Telefon, Rechnungs- und Lieferadresse sowie <Ui>USt-IdNr.</Ui> pflegen.
          </>,
          <>
            Mit <Ui>Kundendaten speichern</Ui> sichern.
          </>,
          <>
            Einladung verloren oder abgelaufen? Unter Ansprechpartner <Ui>Einladung erneut senden</Ui> klicken und die
            Sicherheitsabfrage bestätigen – der Kunde erhält eine neue E-Mail mit Link zum Passwort setzen.
          </>,
          <>
            Unten unter <Ui>Interne Notizen</Ui> Absprachen festhalten und <Ui>Notiz speichern</Ui>.
          </>,
        ],
      },
    ],
    buttons: [
      { label: 'Neuer Kunde', variant: 'brand', icon: Plus },
      { label: 'Kunde anlegen', variant: 'brand' },
      { label: 'Kundendaten speichern', variant: 'brand' },
      { label: 'Einladung erneut senden', icon: Mail },
      { label: 'Angebot für diesen Kunden' },
      { label: 'Notiz speichern' },
    ],
    callouts: [
      {
        kind: 'info',
        text: 'Ein Kunde = ein Zugang. Die Login-E-Mail kann im Backoffice nicht geändert werden. Ist eine E-Mail-Adresse schon vergeben, erscheint „Für diese E-Mail-Adresse existiert bereits ein Zugang.“',
      },
      {
        kind: 'tip',
        text: (
          <>
            <Ui>Einladung erneut senden</Ui> funktioniert, solange der Kunde noch kein Passwort gesetzt hat. Hat er es
            schon gesetzt, erscheint ein Hinweis – dann klickt der Kunde auf der Login-Seite auf{' '}
            <Ui>Passwort vergessen?</Ui> und erhält einen neuen Link.
          </>
        ),
      },
      {
        kind: 'warning',
        text: 'Kann die Einladung nicht verschickt werden (z. B. „Das E-Mail-Limit des Auth-Servers ist erreicht“), wird ein neuer Kunde nicht angelegt bzw. keine erneute Einladung verschickt. Lesen Sie die Fehlermeldung und versuchen Sie es in einigen Minuten erneut.',
      },
      {
        kind: 'info',
        text: 'Der Rabatt ist nur ein interner Richtwert für Ihre Angebote: Er wird nie automatisch abgezogen und der Kunde sieht ihn nicht – berücksichtigen Sie ihn beim Kalkulieren. Das Jahresbudget sieht der Kunde („Mein Konto“, Budget-Balken unter „Bestellungen“); es ist nur eine Information und sperrt keine Bestellung.',
      },
      {
        kind: 'info',
        text: 'Interne Notizen sieht nur das Backoffice, nie der Kunde. Sie lassen sich nicht ändern oder löschen; Autor und Zeit werden automatisch gespeichert.',
      },
      {
        kind: 'warning',
        text: 'Kunden lassen sich im Backoffice nicht löschen. Firmen mit Bestellungen oder Angeboten sind zusätzlich in der Datenbank gegen Löschen geschützt (Aufbewahrungspflicht).',
      },
    ],
  },
  {
    id: 'anfragen',
    title: 'Anfragen',
    short: 'Großanfragen der Kunden prüfen und in ein Angebot überführen.',
    icon: FileText,
    why: 'Hier landen die Großanfragen aus dem Portal – Ihr Ausgangspunkt für Angebote.',
    to: { href: '/admin/anfragen', label: 'Anfragen' },
    Visual: InquiryDiagram,
    filters: ['Offen', 'Neu', 'Angebot gesendet', 'Abgeschlossen', 'Alle'],
    steps: [
      {
        title: "So geht's",
        items: [
          'Bei einer neuen Anfrage erhält das Backoffice eine E-Mail, und in der Navigation erscheint eine Zahl.',
          'Anfrage prüfen: Produkt, Menge, Wunschtermin, Nachricht und Kontakt (E-Mail und Telefon sind anklickbar). Eine Druckdatei laden Sie über den Dateinamen herunter.',
          <>
            Mit <Ui>In Bearbeitung</Ui> zeigen Sie, dass sich jemand kümmert.
          </>,
          <>
            <Ui>Angebot erstellen</Ui> öffnet ein neues Angebot – Kunde, Titel (Produkt) und Menge sind schon
            eingetragen.
          </>,
          <>
            Ohne Angebot erledigt? Dann <Ui>Als erledigt</Ui> klicken.
          </>,
        ],
      },
    ],
    buttons: [
      { label: 'In Bearbeitung', icon: PlayCircle },
      { label: 'Als erledigt', icon: Check },
      { label: 'Angebot erstellen', variant: 'brand' },
    ],
    callouts: [
      { kind: 'info', text: 'Der Filter „Offen“ (Standard) zeigt Anfragen in „Neu“ und „In Bearbeitung“.' },
      {
        kind: 'tip',
        text: 'Der Kunde sieht den Stand seiner Anfrage im Portal („Eingegangen“, „In Bearbeitung“, „Angebot erstellt“, „Abgeschlossen“). Jede Statusänderung steht im Audit-Log.',
      },
    ],
  },
  {
    id: 'angebote',
    title: 'Angebote',
    short: 'Angebote erstellen, senden, korrigieren, zurückziehen und als PDF drucken.',
    icon: FileCheck2,
    why: 'Mit einem Angebot nennen Sie dem Kunden verbindliche Preise; nimmt er an, entsteht daraus automatisch eine Bestellung.',
    to: { href: '/admin/angebote', label: 'Angebote' },
    Visual: QuoteDiagram,
    filters: ['Alle', 'Offen', 'Angenommen', 'Abgelehnt', 'Abgelaufen / zurückgezogen'],
    steps: [
      {
        title: 'Angebot erstellen und senden',
        items: [
          <>
            <Ui>Neues Angebot</Ui> klicken – oder aus einer Anfrage <Ui>Angebot erstellen</Ui>, bzw. beim Kunden{' '}
            <Ui>Angebot für diesen Kunden</Ui>.
          </>,
          <>
            Kunde wählen, <Ui>Titel</Ui> vergeben und <Ui>Gültig bis (einschließlich)</Ui> prüfen (vorbelegt: heute + 30
            Tage; nicht in der Vergangenheit).
          </>,
          <>
            Positionen mit Artikel, Farbe, Größe, Menge und <Ui>€/Stück netto</Ui> eintragen; weitere über{' '}
            <Ui>Position hinzufügen</Ui>.
          </>,
          <>
            Optional einen <Ui>Hinweis zum Angebot</Ui> schreiben (für den Kunden sichtbar, z. B. Lieferzeit).
          </>,
          <>
            <Ui>Angebot senden</Ui> – der Kunde sieht das Angebot sofort im Portal und erhält eine E-Mail.
          </>,
        ],
      },
      {
        title: 'Angebot nachträglich ändern',
        items: [
          <>
            Offenes Angebot öffnen, <Ui>Bearbeiten</Ui>, ändern und <Ui>Änderungen speichern</Ui>. Der Kunde sieht die
            Änderung sofort, eine neue E-Mail geht nicht raus.
          </>,
          <>
            Nicht mehr gültig? <Ui>Zurückziehen</Ui> und die Sicherheitsabfrage bestätigen – der Kunde kann es danach
            nicht mehr annehmen.
          </>,
          <>
            Abgeschlossenes Angebot (angenommen, abgelehnt, abgelaufen)? <Ui>Als Vorlage kopieren</Ui> erstellt ein
            neues Angebot mit denselben Positionen; beim Senden erhält der Kunde eine neue E-Mail.
          </>,
          <>
            <Ui>Als PDF / Drucken</Ui> öffnet das Angebot druckfertig – im Druckdialog „Als PDF speichern“ wählen.
          </>,
        ],
      },
    ],
    buttons: [
      { label: 'Neues Angebot', variant: 'brand', icon: Plus },
      { label: 'Angebot senden', variant: 'brand' },
      { label: 'Bearbeiten', icon: Pencil },
      { label: 'Als Vorlage kopieren', icon: Copy },
      { label: 'Zurückziehen', variant: 'destructive', icon: Undo2 },
      { label: 'Als PDF / Drucken', icon: Printer },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Positionen mit 0 € müssen Sie ausdrücklich bestätigen: Haken bei „Ich bestätige, dass diese Position kostenlos ist“. Ohne Haken lässt sich das Angebot nicht senden.',
      },
      {
        kind: 'info',
        text: 'Offene Angebote, deren „Gültig bis“-Datum vorbei ist, werden jede Nacht automatisch auf „Abgelaufen“ gesetzt. Drei Tage vor Ablauf erhält der Kunde einmalig eine Erinnerungs-Mail (nicht bei zurückgezogenen und erst seit weniger als 2 Tagen bestehenden Angeboten).',
      },
      {
        kind: 'info',
        text: `Versandkosten: ab ${formatEUR(FREE_SHIPPING_FROM)} netto Warenwert kostenlos, sonst ${formatEUR(FLAT_SHIPPING)} netto. Dieselbe Regel gilt im Angebots-PDF und in der Bestellung, die bei Annahme entsteht.`,
      },
      {
        kind: 'tip',
        text: 'Öffnet sich beim PDF nichts, erlauben Sie Pop-ups für das Portal im Browser.',
      },
    ],
  },
  {
    id: 'bestellungen',
    title: 'Bestellungen',
    short: 'Status, Preise, Versand, Stornos, Reklamationen und Dokumente pflegen.',
    icon: ShoppingBag,
    why: 'Hier bearbeiten Sie alle Kundenbestellungen bis zur Auslieferung – und legen bei Bedarf selbst Bestellungen an.',
    to: { href: '/admin/bestellungen', label: 'Bestellungen' },
    Visual: OrderDiagram,
    filters: ['Alle', 'Preise unbestätigt', 'Reklamationen', 'Offen', 'In Bearbeitung', 'Versendet', 'Abgeschlossen', 'Storniert'],
    steps: [
      {
        title: 'Bestellung bearbeiten und versenden',
        items: [
          <>
            Bestellung über Suche (Bestellnr., Firma, Kd-Nr. oder Bestellzeichen), Zeitraum oder Filter finden und{' '}
            <Ui>Bearbeiten</Ui> klicken.
          </>,
          'Positionen, Bestelldetails (Bestellzeichen, Wunschtermin, Lieferadresse) und die Anmerkung des Kunden prüfen. Druckdateien laden Sie über den Dateinamen an der Position herunter.',
          <>
            Rechts den neuen Status wählen und <Ui>Änderungen speichern</Ui>.
          </>,
          <>
            Zum Versand <Ui>Versanddienst</Ui>, <Ui>Sendungsnummer</Ui> und <Ui>Tracking-Link</Ui> (https://…) eintragen,
            Status „Versendet“ wählen und speichern – der Kunde erhält einmalig die Versand-Mail.
          </>,
          <>
            Sendungsnummer oder Versanddienst später ergänzt oder korrigiert? Eintragen und <Ui>Änderungen speichern</Ui> –
            der Kunde erhält die kurze E-Mail „Sendungsverfolgung aktualisiert“ mit den neuen Daten.
          </>,
          <>
            Für das Paket <Ui>Lieferschein drucken</Ui> klicken – im Druckdialog drucken oder „Als PDF speichern“.
          </>,
          'Nach der Zustellung auf „Abgeschlossen“ setzen.',
        ],
      },
      {
        title: 'Preise bestätigen',
        items: [
          <>
            Filter <Ui>Preise unbestätigt</Ui> öffnen – betroffene Bestellungen tragen ein gelbes Abzeichen.
          </>,
          'In der Bestellung im gelben Kasten jeden Netto-Einzelpreis prüfen und bei Bedarf korrigieren.',
          <>
            <Ui>Preise bestätigen</Ui> klicken. Der Kunde erhält eine E-Mail mit den bestätigten Preisen; erst jetzt ist
            „Versendet“ möglich.
          </>,
        ],
      },
      {
        title: 'Reklamation bearbeiten',
        items: [
          <>
            Filter <Ui>Reklamationen</Ui> öffnen; die Bestellung zeigt oben den Kasten „Reklamation vom Kunden“.
          </>,
          <>
            Bearbeitungsstatus wählen: <Ui>Offen</Ui>, <Ui>In Bearbeitung</Ui> oder <Ui>Erledigt</Ui>.
          </>,
          'Optional eine interne Notiz ergänzen (z. B. „Ersatz in Produktion“) – sie erscheint unter den internen Notizen mit dem Hinweis „Reklamation“.',
          <>
            <Ui>Reklamation aktualisieren</Ui> klicken.
          </>,
        ],
      },
      {
        title: 'Bestellung manuell anlegen',
        items: [
          <>
            <Ui>Neue Bestellung</Ui> klicken und den Kunden wählen.
          </>,
          'Status wählen (Offen, In Bearbeitung, Versendet oder Abgeschlossen) und die Positionen eintragen.',
          <>
            Bei „Versendet“ optional <Ui>Versanddienst</Ui>, <Ui>Sendungsnummer</Ui> und <Ui>Tracking-Link</Ui> eintragen.
          </>,
          <>
            Optional <Ui>Anmerkung für den Kunden</Ui> (im Portal sichtbar), <Ui>Interne Notiz</Ui> und ein Dokument über{' '}
            <Ui>PDF anhängen</Ui> (max. 4 MB).
          </>,
          <>
            Haken <Ui>Bestellbestätigung per E-Mail an den Kunden senden</Ui> (bei „Versendet“:{' '}
            <Ui>Bestellbestätigung und Versand-Mail an den Kunden senden</Ui>) setzen oder entfernen, dann{' '}
            <Ui>Bestellung anlegen</Ui>.
          </>,
        ],
      },
    ],
    buttons: [
      { label: 'Neue Bestellung', variant: 'brand', icon: Plus },
      { label: 'Bearbeiten' },
      { label: 'Preise bestätigen', variant: 'brand' },
      { label: 'Änderungen speichern', variant: 'brand' },
      { label: 'Reklamation aktualisieren' },
      { label: 'Lieferschein drucken', icon: Printer },
      { label: 'Dokument (PDF) anhängen', icon: FileText },
      { label: 'Download', icon: Download },
      { label: 'Ersetzen', icon: RefreshCw },
      { label: 'Bestellung anlegen', variant: 'brand' },
    ],
    callouts: [
      {
        kind: 'warning',
        text: 'Vorläufige Preise entstehen bei Nachbestellungen des Kunden, wenn es für Artikel, Variante oder Menge keinen bestätigten Preis aus einer früheren Bestellung gibt. Solange sie unbestätigt sind, sind „Versendet“ und „Abgeschlossen“ gesperrt und die Bestellung zählt nicht zum Auftragswert. Stornierte oder abgeschlossene Bestellungen lassen sich nicht mehr neu bepreisen.',
      },
      {
        kind: 'warning',
        text: 'Stornieren ist endgültig: „Storniert“ ist nur aus „Offen“ oder „In Bearbeitung“ möglich, der Kunde erhält eine Storno-Mail. Kunden können im Portal selbst nur offene Bestellungen stornieren – dann bekommt das Backoffice eine Kopie.',
      },
      {
        kind: 'tip',
        text: 'Tragen Sie die Sendungsnummer möglichst zusammen mit „Versendet“ ein – dann steht sie gleich in der Versand-Mail. Ändern Sie Versanddienst oder Sendungsnummer später, erhält der Kunde je neuer Sendungsnummer einmal die E-Mail „Sendungsverfolgung aktualisiert“ (nur wenn er die Versand-Mail schon bekommen hat; nur den Tracking-Link zu ändern löst keine E-Mail aus).',
      },
      {
        kind: 'info',
        text: 'Die Rechnung kommt aus Ihrer Buchhaltung: Hängen Sie sie über „Dokument (PDF) anhängen“ an – der Kunde kann sie dann im Portal herunterladen. Mit „Ersetzen“ tauschen Sie sie aus. Der Lieferschein wird dagegen direkt aus der Bestellung erzeugt (ohne Preise; Lieferadresse der Bestellung, sonst die des Kunden; Bestellzeichen, Positionen und – falls eingetragen – Sendungsnummer). Bei stornierten Bestellungen ist er gesperrt.',
      },
      {
        kind: 'info',
        text: 'Manuelle Bestellungen haben immer bestätigte Preise. Legen Sie eine Bestellung direkt als „Versendet“ an und lassen den Haken gesetzt, erhält der Kunde erst die Bestellbestätigung und danach die Versand-Mail (mit Sendungsnummer, falls eingetragen). Ohne Haken geht keine E-Mail raus – auch keine spätere zur Sendungsverfolgung.',
      },
      {
        kind: 'tip',
        text: 'Über „Export der aktuellen Auswahl“ laden Sie die gefilterte Liste als CSV für Excel: „Bestellungen“ (eine Zeile je Bestellung) oder „Positionen“ (eine Zeile je Position).',
      },
      {
        kind: 'info',
        text: 'Der „Verlauf“ zeigt jeden Statuswechsel mit Zeitpunkt – auch der Kunde sieht ihn. Interne Notizen bleiben dagegen im Backoffice.',
      },
    ],
  },
  {
    id: 'audit',
    title: 'Audit-Log',
    short: 'Lückenloses, unveränderliches Protokoll aller Aktionen.',
    icon: ScrollText,
    why: 'Hier sehen Sie, wer wann was geändert hat – im Backoffice und im Kundenportal.',
    to: { href: '/admin/audit', label: 'Audit-Log' },
    Visual: AuditDiagram,
    steps: [
      {
        title: "So geht's",
        items: [
          'Das Log zeigt die neuesten Einträge zuerst: Zeitpunkt, Benutzer (E-Mail), Aktion und Detail mit Kunde.',
          <>
            Für ältere Einträge unten <Ui>Mehr laden</Ui> klicken.
          </>,
          'Steht als Benutzer „System“, wurde die Aktion ohne angemeldeten Benutzer ausgeführt.',
        ],
      },
    ],
    callouts: [
      {
        kind: 'info',
        text: 'Einträge können von niemandem geändert oder gelöscht werden – auch nicht von Admins. Zeitpunkt und Benutzer setzt die Datenbank selbst.',
      },
    ],
  },
  {
    id: 'emails',
    title: 'E-Mails',
    short: 'Welche E-Mail wann an wen geht.',
    icon: Mail,
    why: 'Das Portal informiert Kunden und Backoffice automatisch – hier sehen Sie, wann.',
    Visual: MailDiagram,
    callouts: [
      {
        kind: 'info',
        text: 'Jedes Ereignis wird pro Bestellung, Angebot oder Anfrage höchstens einmal verschickt – auch wenn Sie mehrfach speichern. Ausnahme „Sendungsverfolgung aktualisiert“: einmal je neuer Sendungsnummer bzw. neuem Versanddienst. Eine Kopie ans Backoffice gibt es nur, wenn der Kunde selbst gehandelt hat.',
      },
      {
        kind: 'info',
        text: 'E-Mails werden im Hintergrund versendet. Schlägt der Versand fehl, bleibt Ihre Aktion trotzdem gespeichert.',
      },
    ],
  },
  {
    id: 'admins',
    title: 'Für Administratoren',
    short: 'Backoffice-Zugänge vergeben und entziehen.',
    icon: ShieldCheck,
    why: 'Wer Zugriff auf das Backoffice hat, wird außerhalb des Portals in der Datenbank festgelegt.',
    steps: [
      {
        title: 'Zugang vergeben oder entziehen',
        items: [
          'Im Supabase-Dashboard unter Authentication → Users → „Invite user“ die Person einladen; sie setzt über den Link ihr Passwort.',
          <>
            Im SQL-Editor ausführen: <Code>select public.b2b_grant_admin('name@firma.de');</Code>
          </>,
          <>
            Entziehen mit <Code>select public.b2b_revoke_admin('name@firma.de');</Code> – der letzte Admin bleibt immer
            erhalten.
          </>,
          'Admins melden sich ganz normal unter /login an und landen im Backoffice.',
        ],
      },
    ],
    callouts: [
      { kind: 'warning', text: 'Ein Kundenzugang kann nicht gleichzeitig Admin sein.' },
      { kind: 'info', text: 'Vergeben und Entziehen stehen im Audit-Log. Für Admins wird die Zwei-Faktor-Anmeldung (MFA) empfohlen.' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function GuideSectionCard({ section: s }: { section: GuideSection }) {
  const Icon = s.icon
  return (
    <section id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-muted text-brand">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 id={`${s.id}-title`} className="text-lg font-semibold tracking-tight">
              {s.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Wofür? </span>
              {s.why}
            </p>
          </div>
        </div>

        {s.Visual && (
          <div className="mt-5">
            <s.Visual />
          </div>
        )}

        {s.filters && (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filter auf der Seite</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {s.filters.map((f, i) => (
                <FilterMock key={f} label={f} active={i === 0} />
              ))}
            </div>
          </div>
        )}

        {s.steps && (
          <div className={cn('mt-6 grid gap-6', s.steps.length > 1 && 'lg:grid-cols-2')}>
            {s.steps.map((list) => (
              <Steps key={list.title} {...list} />
            ))}
          </div>
        )}

        {s.buttons && (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Diese Schaltflächen finden Sie dort
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.buttons.map((b) => (
                <ButtonMock key={b.label} {...b} />
              ))}
            </div>
          </div>
        )}

        {s.callouts && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {s.callouts.map((c, i) => (
              <CalloutBox key={i} {...c} />
            ))}
          </div>
        )}

        {s.to && (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <Link to={s.to.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              Zur Seite „{s.to.label}“ <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </Card>
    </section>
  )
}

export default function AdminGuide() {
  const { hash } = useLocation()

  // Deep links (/admin/anleitung#angebote): the lazy page renders after the
  // browser tried to scroll, so jump to the section once it exists.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])

  return (
    <div>
      <PageHeader
        title="Anleitung"
        description="Alle Bereiche des Backoffice erklärt – mit den typischen Abläufen und den E-Mails, die dabei verschickt werden."
      />

      <Card className="mb-6 flex gap-3 p-5 text-sm">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-brand" />
        <div className="space-y-1.5 leading-relaxed">
          <p>
            Neu im Team? Lesen Sie zuerst <a href="#ablauf" className="font-medium text-brand hover:underline">Der typische Ablauf</a>.
            Jeder Abschnitt erklärt kurz, wofür ein Bereich da ist, zeigt die Schritte und endet mit einem Link zur
            echten Seite.
          </p>
          <p className="text-muted-foreground">
            Begriffe wie <Ui>Angebot senden</Ui> sind genau so beschriftet wie in der Oberfläche. Grau-gestrichelte Kästen
            zeigen, wie die Schaltflächen aussehen.
          </p>
        </div>
      </Card>

      <nav aria-label="Inhalt" className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ id, title, short, icon: Icon }) => (
          <a key={id} href={`#${id}`} className="group">
            <Card className="flex h-full gap-3 p-4 transition-colors group-hover:border-brand/40">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-brand-muted group-hover:text-brand">
                <Icon className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{short}</p>
              </div>
            </Card>
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <GuideSectionCard key={s.id} section={s} />
        ))}
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" /> Diese Anleitung ist nur im Backoffice sichtbar.
      </p>
    </div>
  )
}
