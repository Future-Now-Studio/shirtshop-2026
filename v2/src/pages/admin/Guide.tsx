import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, BookOpen, Boxes, Check, ClipboardList, Copy, Download, FileText, Folder, FolderArchive, Image as ImageIcon,
  Info, KeyRound, LayoutDashboard, Lightbulb, Mail, MailWarning, MessageSquare, Package, Palette, Percent, Ruler,
  Settings, Shirt, ShieldOff, ShoppingBag, SquareDashed, Star, StickyNote, Ticket, Trash2, Truck, Undo2, Upload, X,
  type LucideIcon,
} from "lucide-react";
import { SET_PASSWORD_PATH } from "@/lib/auth";
import { cn } from "@/lib/utils";

// In-app manual for the shop owner. Every text describes what the admin pages
// actually do — button labels are copied verbatim so they can be recognised.
// When an admin page changes, update the matching section here.

// ---------------------------------------------------------------------------
// Building blocks

/** Look-alike of a real admin button (not clickable). */
function Ui({ children, icon: Icon, variant = "outline" }: { children: ReactNode; icon?: LucideIcon; variant?: "outline" | "primary" | "danger" }) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 align-middle text-xs font-medium",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "outline" && "border bg-background",
        variant === "danger" && "border border-destructive/40 bg-background text-destructive",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

// Same colours as the status badges in Orders.tsx.
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "offen", cls: "bg-secondary text-secondary-foreground" },
  paid: { label: "bezahlt", cls: "bg-green-100 text-green-800" },
  in_production: { label: "in produktion", cls: "bg-amber-100 text-amber-800" },
  shipped: { label: "versendet", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "abgeschlossen", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "storniert", cls: "bg-muted text-muted-foreground" },
  refunded: { label: "erstattet", cls: "bg-rose-100 text-rose-800" },
};

function Chip({ status }: { status: string }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS[status].cls)}>
      {STATUS[status].label}
    </span>
  );
}

/** Small coloured label, e.g. „Entwurf“ or „ausverkauft“. */
function Tag({ children, cls }: { children: ReactNode; cls: string }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-xs font-medium", cls)}>{children}</span>;
}

type NoteKind = "tip" | "warn" | "info";
interface Note { kind: NoteKind; text: ReactNode }

const NOTE_STYLE: Record<NoteKind, { icon: LucideIcon; title: string; cls: string; iconCls: string }> = {
  tip: { icon: Lightbulb, title: "Tipp", cls: "border-primary/20 bg-accent/60", iconCls: "text-primary" },
  warn: { icon: AlertTriangle, title: "Achtung", cls: "border-amber-300 bg-amber-50 text-amber-900", iconCls: "text-amber-600" },
  info: { icon: Info, title: "Gut zu wissen", cls: "bg-muted/40", iconCls: "text-muted-foreground" },
};

function Callout({ kind, children }: { kind: NoteKind; children: ReactNode }) {
  const s = NOTE_STYLE[kind];
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", s.cls)}>
      <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconCls)} />
      <div><span className="font-semibold">{s.title}: </span>{children}</div>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <div className="min-w-0 pt-0.5">{item}</div>
        </li>
      ))}
    </ol>
  );
}

/** Arrow between flow boxes: points down on narrow screens, right from lg upwards (the admin sidebar takes 200 px). */
function FlowArrow() {
  return <ArrowRight aria-hidden className="mx-auto h-4 w-4 shrink-0 rotate-90 self-center text-muted-foreground lg:mx-0 lg:rotate-0" />;
}

function FlowBox({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex-1 rounded-lg border bg-background p-3 text-sm">
      <p className="mb-1 flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" /> {title}</p>
      <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function Figure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="rounded-xl border bg-muted/30 p-4">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</figcaption>
      {children}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Diagrams

// Mirrors NEXT_STATUS in Orders.tsx (and the DB guard behind it).
const NEXT_STATUS: [string, string[]][] = [
  ["pending", ["paid", "cancelled"]],
  ["paid", ["in_production", "shipped", "completed"]],
  ["in_production", ["paid", "shipped", "completed"]],
  ["shipped", ["in_production", "completed"]],
  ["completed", ["shipped"]],
];

const MAIN_FLOW: [string, string][] = [
  ["pending", "Zahlung fehlt noch. Shop-Bestellungen kommen meist direkt als „bezahlt“ an."],
  ["paid", "Geld ist da. Jetzt prüfen und produzieren."],
  ["in_production", "Wird gerade gedruckt."],
  ["shipped", "Paket ist unterwegs. Das Versanddatum wird automatisch gesetzt."],
  ["completed", "Alles erledigt."],
];

function OrderStatusDiagram() {
  return (
    <Figure title="Status einer Bestellung">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {MAIN_FLOW.map(([s, text], i) => (
          <div key={s} className="contents">
            {i > 0 && <FlowArrow />}
            <div className="flex-1 rounded-lg border bg-background p-3">
              <Chip status={s} />
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-dashed bg-background p-3 text-xs leading-relaxed">
          <p className="mb-2 flex flex-wrap items-center gap-2"><Chip status="pending" /> <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> <Chip status="cancelled" /></p>
          <p className="text-muted-foreground">Nur unbezahlte Bestellungen kannst du im Status-Feld stornieren.</p>
        </div>
        <div className="rounded-lg border border-dashed bg-background p-3 text-xs leading-relaxed">
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">bezahlt … abgeschlossen</span> <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> <Chip status="refunded" />
          </p>
          <p className="text-muted-foreground">
            Nur über <Ui icon={Undo2} variant="danger">Vollständig erstatten / stornieren</Ui> im Kasten „Rückerstattung“ – nie über das Status-Feld.
          </p>
        </div>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted-foreground">Welcher Wechsel im Status-Feld möglich ist</p>
      <ul className="divide-y rounded-lg border bg-background">
        {NEXT_STATUS.map(([from, to]) => (
          <li key={from} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="w-28 shrink-0"><Chip status={from} /></span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            {to.map((s) => <Chip key={s} status={s} />)}
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex w-28 shrink-0 gap-1"><Chip status="cancelled" /></span>
          <span className="flex gap-1"><Chip status="refunded" /></span>
          <span>Endstation – kein Wechsel mehr möglich.</span>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Rückschritte (z. B. von „versendet“ zurück auf „in produktion“) sind erlaubt, falls du dich verklickt hast.</p>
    </Figure>
  );
}

// File names as written by the designer (Designer.tsx), one set per designed view.
const ZIP_FILES: [string, string][] = [
  ["front-print.png", "Druckdatei"],
  ["front-original-1.jpg", "Original des Kunden"],
  ["front-element-1.png", "einzelnes Element"],
  ["front-design.png", "ganzes Motiv"],
  ["front-composite.png", "Vorschau auf dem Shirt"],
  ["design.json", "Design-Daten (zum Nachbauen)"],
];

function ProductionDiagram() {
  return (
    <Figure title="Von der Bestellung zur Produktion">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <FlowBox icon={Shirt} title="Kunde gestaltet">Im Designer Text, Logo oder Foto platzieren. Beim „In den Warenkorb“ werden alle Dateien gespeichert.</FlowBox>
        <FlowArrow />
        <FlowBox icon={ShoppingBag} title="Bestellung">Unter „Positionen“ siehst du je Artikel die Vorschau, die Druckdatei mit Maß, die Original-Uploads, das Motiv und die Einzel-Elemente.</FlowBox>
        <FlowArrow />
        <FlowBox icon={FolderArchive} title="ZIP laden">Im Kasten „Dokumente“ auf „Design-Dateien (ZIP)“ klicken.</FlowBox>
        <FlowArrow />
        <FlowBox icon={Package} title="Produktion">ZIP an die Druckerei / an den Drucker geben, Status auf „in produktion“.</FlowBox>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Inhalt der ZIP-Datei (Beispiel)</p>
          <div className="rounded-lg border bg-background p-3 text-[11px] leading-relaxed">
            <p className="flex items-center gap-1.5 break-all font-mono"><FolderArchive className="h-3.5 w-3.5 shrink-0 text-primary" /> bestellung-PS-2026-00012-designs.zip</p>
            <ul className="ml-1.5 mt-1 space-y-1 border-l pl-3">
              <li className="flex items-center gap-1.5 font-mono"><FileText className="h-3.5 w-3.5 shrink-0" /> PRODUKTION.txt</li>
              <li>
                <p className="flex items-center gap-1.5 font-mono"><Folder className="h-3.5 w-3.5 shrink-0" /> T-Shirt_Schwarz_L_2x/</p>
                <ul className="ml-1.5 mt-1 space-y-1 border-l pl-3">
                  {ZIP_FILES.map(([name, note]) => (
                    <li key={name} className="flex flex-wrap gap-x-2">
                      <span className="font-mono">{name}</span>
                      <span className="text-muted-foreground">← {note}</span>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ein Ordner je Position (Produkt_Farbe_Größe_Menge). „front“ = vorne, „back“ = hinten, „left“ = links, „right“ = rechts.
          </p>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">PRODUKTION.txt</p>
          <pre className="overflow-x-auto rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed">
{`Bestellung PS-2026-00012
Kunde: Max Mustermann

2× T-Shirt — Schwarz / L
   Ordner: T-Shirt_Schwarz_L_2x/
   Vorne: front-print.png · 30 × 40 cm · 300 dpi · Zone „Brust groß 30x40 cm“
   Hinten: back-print.png · 25,3 × 12 cm · 400 dpi · Zone „Rücken“
      ACHTUNG: Maß geschätzt (Druckzone ohne cm-Angabe im Namen) – vor dem Druck prüfen

1× Hoodie — Weiß / M
   ohne Design`}
          </pre>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li><b className="text-foreground">…-print.png</b> – die Datei zum Drucken: transparent, auf die Druckzone bzw. das Motiv zugeschnitten, ca. 4000 px. Maß, DPI und Druckzone stehen in der PRODUKTION.txt.</li>
            <li><b className="text-foreground">…-original-…</b> – die unveränderte Datei, die der Kunde hochgeladen hat.</li>
            <li><b className="text-foreground">…-element-…</b> – jeder Text und jedes Bild einzeln, falls du etwas neu setzen musst.</li>
            <li><b className="text-foreground">ACHTUNG</b> in der PRODUKTION.txt – Maß nur geschätzt, Auflösung unter 100 dpi oder Motiv ragt über die Druckzone: vor dem Druck klären.</li>
          </ul>
        </div>
      </div>
    </Figure>
  );
}

function ProductDiagram() {
  const parts: { icon: LucideIcon; title: string; tab: string; text: string }[] = [
    { icon: Shirt, title: "Produkt", tab: "Basis", text: "Name, Shop-Adresse, Kategorie, Beschreibung, Preise, Status." },
    { icon: Palette, title: "Farben", tab: "Varianten & Bilder", text: "Jede Farbe ist eine Variante des Produkts." },
    { icon: ImageIcon, title: "Ansichten", tab: "Varianten & Bilder", text: "Je Farbe ein Foto für Vorne, Hinten, Links, Rechts." },
    { icon: Ruler, title: "Größen & Bestand", tab: "Größen & Bestand", text: "Welche Größen es gibt und wie viele je Farbe × Größe da sind." },
    { icon: SquareDashed, title: "Druckzonen", tab: "Druckzonen", text: "Wo gedruckt werden darf – je Ansicht, gilt für alle Farben." },
  ];
  return (
    <Figure title="So ist ein Produkt aufgebaut">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {parts.map((part, i) => (
          <div key={part.title} className="contents">
            {i > 0 && <FlowArrow />}
            <FlowBox icon={part.icon} title={part.title}>
              {part.text}
              <span className="mt-2 block text-[11px]">Tab: <span className="font-medium text-foreground">{part.tab}</span></span>
            </FlowBox>
          </div>
        ))}
      </div>
    </Figure>
  );
}

/** The five conditions of lib/publish-check.ts, in the same order. */
function PublishChecklist() {
  const items = [
    "mindestens eine Farbe (Variante)",
    "für jede Farbe ein Bild „Vorne“",
    "mindestens eine Größe aktiviert",
    "für mindestens eine Farbe/Größe Bestand eingetragen",
    "mindestens eine Druckzone",
  ];
  return (
    <Figure title="Bevor ein Produkt veröffentlicht werden kann">
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-800"><Check className="h-3.5 w-3.5" /></span>
            {t}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Fehlt etwas, erscheint „Noch nicht veröffentlichbar: …“ mit dem genauen Grund – das Produkt bleibt dann ein Entwurf.
      </p>
    </Figure>
  );
}

function PrintZoneMock() {
  return (
    <Figure title="Druckzone richtig benennen">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Same look as the zone in PrintZoneEditor: primary frame, label top left, handle bottom right */}
        <div className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 overflow-hidden rounded-lg border bg-background sm:mx-0">
          <Shirt aria-hidden strokeWidth={0.75} className="absolute inset-0 h-full w-full text-muted-foreground/40" />
          <div className="absolute border-2 border-primary bg-primary/10" style={{ left: "32%", top: "30%", width: "36%", height: "46%" }}>
            <span className="absolute left-0 top-0 bg-primary px-1 text-[9px] text-primary-foreground">Brust groß 30x40 cm</span>
            <span className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-sm border-2 border-primary bg-background" />
          </div>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <p className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-800"><Check className="h-3.5 w-3.5" /></span> <code className="rounded bg-background px-1.5 py-0.5 text-xs">Brust groß 30x40 cm</code></p>
          <p className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-800"><Check className="h-3.5 w-3.5" /></span> <code className="rounded bg-background px-1.5 py-0.5 text-xs">Rücken 29,7x42 cm</code></p>
          <p className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-800"><X className="h-3.5 w-3.5" /></span> <code className="rounded bg-background px-1.5 py-0.5 text-xs">Zone 1</code> <span className="text-xs text-muted-foreground">– Größe wird nur geschätzt</span></p>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            Schreibweise: <b>Breite x Höhe cm</b> irgendwo im Namen. „x“ oder „×“, Komma oder Punkt sind egal.
            Daraus rechnet der Shop die echte Druckgröße in cm und prüft, ob Kundenfotos scharf genug sind.
          </p>
        </div>
      </div>
    </Figure>
  );
}

function StockMock() {
  const cells: [string, number[]][] = [["Schwarz", [12, 3, 0]], ["Weiß", [8, 15, 4]]];
  const threshold = 5;
  return (
    <Figure title="Farben im Bestandsraster (Warnschwelle 5)">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-1.5 text-left font-semibold">Farbe</th>
              {["S", "M", "L"].map((s) => <th key={s} className="px-2 py-1.5 text-center font-semibold">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {cells.map(([color, values]) => (
              <tr key={color}>
                <td className="px-3 py-1.5 font-medium">{color}</td>
                {values.map((n, i) => (
                  <td key={i} className="px-2 py-1">
                    <span className={cn(
                      "flex h-8 w-14 items-center justify-center rounded border text-sm",
                      n === 0 ? "border-red-200 bg-red-50 text-red-800" : n < threshold ? "border-amber-300 bg-amber-50" : "border-input bg-background",
                    )}>{n}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Tag cls="bg-red-100 text-red-800">0 = ausverkauft</Tag>
        <Tag cls="bg-amber-100 text-amber-800">unter der Warnschwelle</Tag>
        <Tag cls="border bg-background text-foreground">genug da</Tag>
      </p>
    </Figure>
  );
}

function NewsletterDiagram() {
  return (
    <Figure title="Newsletter-Anmeldung (Double-Opt-in)">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <FlowBox icon={Mail} title="Anmeldung">Jemand trägt im Shop seine E-Mail ein.</FlowBox>
        <FlowArrow />
        <FlowBox icon={MailWarning} title="unbestätigt">Er bekommt eine Mail mit Bestätigungslink. Ohne Klick wird die Adresse nach 7 Tagen automatisch gelöscht.</FlowBox>
        <FlowArrow />
        <FlowBox icon={Check} title="bestätigt">Erst jetzt darfst du ihm einen Newsletter schicken.</FlowBox>
      </div>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Content

interface Block { title?: string; visual?: ReactNode; steps?: ReactNode[]; notes?: Note[] }
interface Section {
  id: string;
  title: string;
  icon: LucideIcon;
  to: string;
  /** One line for the table of contents. */
  short: string;
  /** „Wofür?“ – one sentence. */
  why: ReactNode;
  blocks: Block[];
}

const SECTIONS: Section[] = [
  {
    id: "uebersicht",
    title: "Übersicht",
    icon: LayoutDashboard,
    to: "/admin",
    short: "Umsatz und offene Arbeit auf einen Blick",
    why: "Zeigt dir beim Öffnen des Admin-Bereichs, wie das Geschäft läuft und ob etwas auf dich wartet.",
    blocks: [
      {
        steps: [
          <>Oben stehen Hinweise, wenn es Arbeit gibt: Der gelbe Kasten <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"><AlertTriangle className="h-3 w-3" /> 2 Bestellungen müssen geprüft werden</span> führt direkt zu diesen Bestellungen.</>,
          <>„… in Bearbeitung (bezahlt, noch nicht versendet)“ zeigt, wie viele Pakete noch rausmüssen.</>,
          <>Die vier Kacheln: <b>Umsatz brutto (bezahlt)</b> inkl. Versand und abzüglich Erstattungen (darunter die letzten 30 Tage), <b>Bezahlte Bestellungen</b>, <b>Ø Bestellwert</b> und <b>Bestellungen gesamt</b>.</>,
          <>„Top-Produkte“ listet die fünf meistverkauften Produkte nach Stückzahl. Die Kacheln rechts daneben führen zu Produkten, Bestellungen, Farben und Größen.</>,
        ],
        notes: [
          { kind: "info", text: "Stornierte und erstattete Bestellungen zählen nicht zum Umsatz – „Bestellungen gesamt“ zählt sie aber mit." },
        ],
      },
    ],
  },
  {
    id: "bestellungen",
    title: "Bestellungen",
    icon: ShoppingBag,
    to: "/admin/orders",
    short: "Status, Versand, Rechnung, Erstattung, Druckdaten",
    why: "Hier bearbeitest du jede Bestellung vom Zahlungseingang bis zum Versand – inklusive Rechnung, Druckdateien und Erstattung.",
    blocks: [
      {
        title: "Liste und Suche",
        steps: [
          <>Oben suchst du nach <b>Name, E-Mail oder Bestellnummer</b> (z. B. PS-2026-00012). Daneben filterst du nach Status – „⚠ Prüfen nötig“ zeigt nur markierte Bestellungen.</>,
          <>Symbole in der Liste: <Tag cls="bg-amber-100 text-amber-900"><AlertTriangle className="mr-1 inline h-3 w-3" />prüfen</Tag> = Bestellung hat einen Prüfhinweis. <Tag cls="bg-rose-100 text-rose-800"><AlertTriangle className="mr-1 inline h-3 w-3" />Chargeback</Tag> = die Zahlung wurde angefochten. <MailWarning className="inline h-4 w-4 text-amber-600" /> = die Bestellbestätigung kam beim Kunden nicht an.</>,
          <>Ein Klick auf eine Zeile öffnet die Bestellung. <Ui icon={Download}>CSV</Ui> lädt alle Bestellungen des aktuellen Filters als Excel-Tabelle.</>,
          <>Ganz unten bei „Belege für die Buchhaltung“ Monat wählen und <Ui icon={Download}>Belege (CSV)</Ui> klicken: alle Rechnungen und Rechnungskorrekturen des Monats mit Netto, USt und Brutto – für dein Steuerbüro.</>,
        ],
      },
      {
        title: "Status ändern",
        visual: <OrderStatusDiagram />,
        steps: [
          <>Bestellung öffnen. Oben rechts steht das Status-Feld – es bietet nur die erlaubten nächsten Schritte an.</>,
          <>Beim Drucken auf <Chip status="in_production" /> stellen. Zum Versenden aber besser den Kasten „Versand“ nehmen (siehe unten), damit der Kunde eine Mail bekommt.</>,
        ],
        notes: [
          { kind: "warn", text: <>Wenn du nur im Status-Feld auf „versendet“ stellst, geht <b>keine</b> Versandmail raus. Dafür ist <Ui variant="primary">als versendet markieren + Mail</Ui> da.</> },
        ],
      },
      {
        title: "Prüfhinweis – „Bitte prüfen, bevor produziert wird“",
        steps: [
          <>Bezahlte Bestellungen werden nie verworfen. Passt etwas nicht, bekommt die Bestellung einen gelben Prüfhinweis – und deine Benachrichtigungsmail beginnt mit „⚠️ Prüfen:“.</>,
          <>Mögliche Gründe: nicht genug auf Lager („nur 1 auf Lager“), Größe ist als nicht lieferbar markiert, Artikel nicht mehr im Katalog, ohne Größe bestellt, Gutschein war bereits ausgeschöpft.</>,
          <>Auch eine <b>Zahlungsanfechtung (Chargeback)</b> setzt einen Prüfhinweis – dann heißt der Kasten „Zahlung angefochten – bitte prüfen“ und nennt Betrag, Grund, Antwortfrist und die Stripe-Nummer. Hatte die Bestellung schon einen Hinweis, wird der Chargeback angehängt („; …“), nichts wird überschrieben.</>,
          <>Klär die Sache: Ware nachbestellen, den Kunden fragen oder – wenn es nicht geht – erstatten.</>,
          <>Dann im gelben Kasten auf <Ui>erledigt</Ui> klicken. Der Hinweis verschwindet und wird mit Datum in die „Interne Notiz“ übernommen.</>,
        ],
      },
      {
        title: "Versand",
        steps: [
          <>Im Kasten <b>Versand</b> die <b>Sendungsnummer</b> eintragen (z. B. von DHL).</>,
          <>Häkchen „Rechnung als PDF anhängen“ drin lassen – dann wird die Rechnung jetzt erstellt und trägt das Versanddatum als Lieferdatum.</>,
          <><Ui variant="primary">als versendet markieren + Mail</Ui> klicken. Der Status wird „versendet“ und der Kunde bekommt die Versandmail mit Sendungsnummer.</>,
          <>Mail noch mal schicken? <Ui>Versandmail erneut senden</Ui>. Nur die Nummer ändern? <Ui>speichern</Ui>.</>,
        ],
        notes: [
          { kind: "info", text: "Versand geht nur bei bezahlten Bestellungen (bezahlt oder in produktion)." },
        ],
      },
      {
        title: "Druckdateien für die Produktion",
        visual: <ProductionDiagram />,
        steps: [
          <>Bestellung öffnen und im Kasten <b>Dokumente</b> auf <Ui icon={Package}>Design-Dateien (ZIP)</Ui> klicken.</>,
          <>Die ZIP enthält je Position einen Ordner mit allen Dateien samt <b>design.json</b> und eine <b>PRODUKTION.txt</b>: Menge, Produkt, Farbe und Größe, dazu je Ansicht Druckdatei, Druckmaß in cm, DPI und Druckzone.</>,
          <>Einzelne Dateien kannst du auch direkt unter „Positionen“ laden: Bei <b>Druckdatei</b> stehen Maß, DPI und Druckzone – Klick aufs Bild öffnet sie, <Ui icon={Download}>herunterladen</Ui> speichert sie. Bei „Original-Uploads des Kunden“, „Motiv (transparent)“ oder „Einzel-Elemente“ lädt ein Klick auf das Bild die Datei herunter.</>,
        ],
        notes: [
          { kind: "warn", text: "Steht bei der Druckdatei oder in der PRODUKTION.txt ein Warnhinweis (Maß geschätzt, unter 100 dpi, Motiv ragt über die Druckzone), kläre das vor dem Druck. Ältere Bestellungen ohne Druckdatei: PRODUKTION.txt verweist auf …-design.png, das Maß legst du dann selbst fest." },
          { kind: "tip", text: "Fahr mit der Maus über ein Einzel-Element – der Tooltip zeigt den Text, den der Kunde geschrieben hat. Praktisch zum Gegenlesen." },
        ],
      },
      {
        title: "Rechnung",
        steps: [
          <><Ui icon={FileText}>Rechnung erstellen (PDF)</Ui> erzeugt die Rechnung und lädt sie herunter. Danach heißt der Knopf <Ui icon={FileText}>Rechnung (PDF)</Ui> und lädt immer dieselbe Datei.</>,
          <><Ui icon={Mail}>Rechnung per E-Mail senden</Ui> schickt sie dem Kunden (vorher kommt eine Rückfrage).</>,
        ],
        notes: [
          { kind: "warn", text: "Eine erstellte Rechnung lässt sich nicht mehr ändern, und die Nummern laufen lückenlos weiter (RE-2026-00001, -00002 …). Am besten erst beim Versand erstellen – dann stimmt das Lieferdatum." },
        ],
      },
      {
        title: "Rückerstattung und Storno",
        steps: [
          <>Kasten <b>Rückerstattung</b>: oben steht, was bezahlt und was schon erstattet wurde.</>,
          <>Alles zurück: <Ui icon={Undo2} variant="danger">Vollständig erstatten / stornieren</Ui>. Das Geld geht über Stripe zurück, der Status wird <Chip status="refunded" /> und es entsteht eine Stornorechnung.</>,
          <>Nur einen Teil zurück (z. B. ein Fehldruck): <Ui>Teilerstattung…</Ui>, Betrag und Grund eintragen, <Ui variant="danger">erstatten</Ui>. Der Grund steht auf der Rechnungskorrektur. Status und Bestand bleiben unverändert.</>,
          <>Jede Erstattung bekommt eine eigene Rechnungskorrektur (RK-…). Das PDF lädst du über den Knopf mit der RK-Nummer in der Liste der Erstattungen.</>,
        ],
        notes: [
          { kind: "warn", text: <>Bestand kommt bei einer vollen Erstattung nur zurück, solange die Bestellung noch <Chip status="paid" /> ist. Ab „in produktion“ gilt die Ware als verbraucht – der Bestand bleibt dann, wie er ist. Ein eingelöster Gutschein wird bei voller Erstattung wieder freigegeben.</> },
          { kind: "info", text: "Erstattest du direkt im Stripe-Dashboard, trägt der Shop das automatisch in die Bestellung ein (Grund: „Erstattung über Stripe“), legt die Rechnungskorrektur an und schickt dir eine Mail. Bei einer Zahlungsanfechtung (Chargeback) bekommst du eine Warn-Mail und die Bestellung einen Prüfhinweis (siehe oben) – antworten musst du im Stripe-Dashboard." },
          { kind: "info", text: "Ohne Online-Zahlung (keine Stripe-Zahlung hinterlegt) steht dort „Keine Online-Zahlung – bitte manuell erstatten.“" },
        ],
      },
      {
        title: "Interne Notiz und Datenschutz",
        steps: [
          <><StickyNote className="inline h-4 w-4" /> <b>Interne Notiz</b>: nur für dich und dein Team, z. B. Druckhinweise oder Absprachen. Mit <Ui>speichern</Ui> sichern.</>,
          <><ShieldOff className="inline h-4 w-4" /> <b>Datenschutz</b>: Will ein Kunde, dass seine Daten gelöscht werden, klick auf <Ui variant="danger">Kundendaten anonymisieren</Ui>. Name, E-Mail, Adresse, Sendungsnummer, interne Notiz und Design-Dateien werden gelöscht.</>,
        ],
        notes: [
          { kind: "info", text: "Beträge, Positionen und Rechnungen bleiben – sie müssen für das Finanzamt aufbewahrt werden. Anonymisieren geht nicht, solange die Bestellung bearbeitet wird (bezahlt oder in produktion) – offene, versendete, abgeschlossene, erstattete und stornierte Bestellungen schon. Es lässt sich nicht rückgängig machen. Daten bei Stripe und in deinem Postfach musst du selbst löschen." },
        ],
      },
    ],
  },
  {
    id: "produkte",
    title: "Produkte",
    icon: Shirt,
    to: "/admin/products",
    short: "Anlegen, Farben, Bilder, Größen, Druckzonen",
    why: "Hier legst du an, was im Shop verkauft und im Designer gestaltet werden kann.",
    blocks: [
      {
        visual: <ProductDiagram />,
        steps: [
          <>Oben bei „Neues Produkt – Name“ den Namen eintippen und <Ui variant="primary">Anlegen</Ui> klicken. Darunter siehst du die künftige Shop-Adresse (/produkt/…).</>,
          <>Produkt in der Liste anklicken. Im Tab <b>Basis</b> Beschreibung, Kategorie, <b>Basispreis</b> und <b>Preis je Design-Element</b> eintragen, dann <Ui variant="primary">Speichern</Ui>.</>,
          <>Tab <b>Varianten & Bilder</b>: Farbe wählen, <Ui variant="primary">Variante anlegen</Ui>. Dann für jede Farbe die Bilder hochladen – Klick auf das Feld <Upload className="inline h-3.5 w-3.5" /> unter Vorne / Hinten / Links / Rechts.</>,
          <>Tab <b>Größen & Bestand</b>: oben die Größen anklicken, die es gibt (farbig = aktiv). In der Tabelle je Farbe × Größe das Häkchen (lieferbar) setzen und die Stückzahl eintragen. Ohne Häkchen ist die Größe abgeschaltet – Bestand speichern unter „Bestand“ schaltet sie nicht wieder ein (Ausnahme: bei 0 Stück gilt sie als ausverkauft, siehe „Bestand“).</>,
          <>Tab <b>Druckzonen</b>: Ansicht wählen, auf dem Bild ein Rechteck ziehen und die Zone rechts mit Maß benennen (siehe unten).</>,
          <>Zum Schluss in der Produktliste auf <Tag cls="bg-secondary text-secondary-foreground">Entwurf</Tag> klicken (oder im Tab Basis den Status ändern). Steht dort <Tag cls="bg-green-100 text-green-800">veröffentlicht</Tag>, ist das Produkt im Shop sichtbar.</>,
        ],
        notes: [
          { kind: "info", text: "Preis für den Kunden = Basispreis + Anzahl Design-Elemente × Preis je Design-Element. Jeder Text und jedes Bild im Designer zählt als ein Element, über alle Ansichten." },
        ],
      },
      {
        title: "Veröffentlichen",
        visual: <PublishChecklist />,
      },
      {
        title: "Bilder",
        steps: [
          <>PNG, JPG oder WebP. Große Fotos werden beim Hochladen automatisch verkleinert (max. 2400 px, 5 MB). SVG geht nicht.</>,
          <>Bild ersetzen: einfach auf das Bild klicken und ein neues wählen. Entfernen: das kleine <X className="inline h-3.5 w-3.5" /> oben rechts.</>,
          <>Mit den Pfeilen neben einer Farbe legst du die Reihenfolge der Farben im Shop fest.</>,
        ],
        notes: [
          { kind: "tip", text: "Nimm für alle Farben Fotos im gleichen Ausschnitt. Die Druckzonen gelten für alle Farben und werden auf dem Bild der ersten Farbe gezeichnet." },
        ],
      },
      {
        title: "Druckzonen",
        visual: <PrintZoneMock />,
        steps: [
          <>Oben die Ansicht wählen (Vorne, Hinten, Links, Rechts). Für die Ansicht muss es schon ein Bild geben.</>,
          <>Mit Maus oder Finger ein Rechteck aufziehen. Verschieben: in die Zone tippen und ziehen. Größe ändern: am Eck unten rechts ziehen.</>,
          <>Rechts unter „Zonen“ den Namen ändern – z. B. aus „Zone 1“ wird „Brust groß 30x40 cm“. Gespeichert wird beim Verlassen des Feldes.</>,
        ],
        notes: [
          { kind: "warn", text: "Schreib immer die echte Größe in cm in den Namen. Ohne Maß schätzt der Shop die Größe – dann stimmen Druckmaß und Schärfe-Warnung für den Kunden nicht." },
        ],
      },
      {
        title: "Kopieren, löschen, CSV",
        steps: [
          <>Das Symbol <Copy className="inline h-4 w-4" /> (Duplizieren) in der Produktliste kopiert ein Produkt mit Farben, Bildern, Größen und Druckzonen. Die Kopie ist ein Entwurf, der Bestand startet bei 0.</>,
          <>Löschen (<Trash2 className="inline h-4 w-4" />) geht nur, solange das Produkt nie bestellt wurde. Sonst auf „Entwurf“ stellen – dann ist es im Shop weg.</>,
          <><Ui icon={Download}>CSV-Export</Ui> lädt alle Produkte. Preise, Namen, Kategorie oder Status in Excel ändern und mit <Ui icon={Upload}>CSV-Import</Ui> zurückspielen. Der Import ändert nur bestehende Produkte – neue legst du oben an.</>,
        ],
        notes: [
          { kind: "info", text: "Eine Farbe, die schon bestellt wurde, kannst du nicht löschen – setz ihren Bestand auf 0. Ändern der Shop-Adresse bei veröffentlichten Produkten macht alte Links ungültig." },
        ],
      },
    ],
  },
  {
    id: "bestand",
    title: "Bestand",
    icon: Boxes,
    to: "/admin/inventory",
    short: "Lager pflegen, Nachbestell-Liste",
    why: "Hier siehst du, was knapp wird, und trägst neue Ware für viele Größen auf einmal ein.",
    blocks: [
      {
        visual: <StockMock />,
        steps: [
          <>Oben bei <b>Nachbestellen</b> stehen alle Größen unter der Warnschwelle – über alle Produkte. Die Zahl im Feld ist die Warnschwelle; ändern und Feld verlassen speichert sie.</>,
          <>„auch Entwürfe“ zeigt auch unveröffentlichte Produkte. <Ui icon={Download}>CSV</Ui> lädt die Liste als Einkaufszettel.</>,
          <>Klick auf eine Zeile öffnet das Produkt im Raster darunter. Oder Produkt oben im Auswahlfeld wählen.</>,
          <>Zahlen im Raster ändern und <Ui variant="primary">speichern (3)</Ui> klicken – die Zahl zeigt, wie viele Felder geändert sind.</>,
        ],
        notes: [
          { kind: "info", text: "Jede bezahlte Bestellung zieht den Bestand automatisch ab. Im Shop verkauft wird eine Größe nur, wenn sie lieferbar ist und mehr als 0 Stück da sind: 0 = ausverkauft. Trägst du für eine ausverkaufte Größe wieder Stück ein, ist sie wieder lieferbar." },
          { kind: "warn", text: "Eine Größe, bei der du unter Produkt → Größen & Bestand das Häkchen „lieferbar“ entfernt hast, bleibt aus – auch wenn du hier Bestand speicherst. Im Raster steht dann „aus“ unter der Zahl. Wieder einschalten: Häkchen im Produkt setzen. Ausnahme: Steht eine abgeschaltete Größe auf 0 Stück, ist sie von einer ausverkauften nicht zu unterscheiden und wird mit neuem Bestand wieder lieferbar." },
          { kind: "tip", text: "Die gelbe Zahl neben „Bestand“ im Menü zeigt, wie viele Größen veröffentlichter Produkte knapp oder ausverkauft sind." },
        ],
      },
    ],
  },
  {
    id: "farben",
    title: "Farben",
    icon: Palette,
    to: "/admin/colors",
    short: "Farbliste für alle Produkte",
    why: "Alle Farben legst du hier einmal an und wählst sie dann bei jedem Produkt aus.",
    blocks: [
      {
        steps: [
          <>Name eintragen (z. B. „Schwarz“), im Feld „Farbe“ den Farbton wählen, <Ui variant="primary">Hinzufügen</Ui>.</>,
          <>Stift-Symbol: Namen oder Farbton ändern. Pfeile: Reihenfolge der Farbliste ändern.</>,
        ],
        notes: [
          { kind: "info", text: "Die Reihenfolge der Farben im Shop legst du je Produkt unter „Varianten & Bilder“ fest. Eine Farbe, die ein Produkt noch nutzt, lässt sich nicht löschen." },
        ],
      },
    ],
  },
  {
    id: "groessen",
    title: "Größen",
    icon: Ruler,
    to: "/admin/sizes",
    short: "Größenliste und Reihenfolge",
    why: "Alle Größen (S, M, L …) legst du hier einmal an; im Produkt schaltest du sie dann ein.",
    blocks: [
      {
        steps: [
          <>Name eintragen (z. B. „XL“) und <Ui variant="primary">Hinzufügen</Ui>.</>,
          <>Mit den Pfeilen sortieren – in dieser Reihenfolge erscheinen die Größen im Shop.</>,
        ],
        notes: [
          { kind: "info", text: "Eine Größe, die ein Produkt noch nutzt, lässt sich nicht löschen." },
        ],
      },
    ],
  },
  {
    id: "rabatte",
    title: "Rabatte",
    icon: Percent,
    to: "/admin/discounts",
    short: "Mengenrabatt nach Stückzahl",
    why: "Mengenrabatte belohnen große Warenkörbe automatisch – ganz ohne Code.",
    blocks: [
      {
        visual: (
          <Figure title="Beispiel">
            <ul className="divide-y rounded-lg border bg-background text-sm">
              <li className="px-4 py-2.5">ab <strong>10</strong> Stück → <strong className="text-primary">5%</strong> Rabatt</li>
              <li className="px-4 py-2.5">ab <strong>25</strong> Stück → <strong className="text-primary">10%</strong> Rabatt</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Bei 30 Teilen im Warenkorb gibt es 10 % – es gilt immer die höchste erreichte Stufe.</p>
          </Figure>
        ),
        steps: [
          <>„Ab Menge“ und „Rabatt (%)“ eintragen, <Ui variant="primary">Hinzufügen</Ui>.</>,
          <>Gibt es die Menge schon, fragt der Shop, ob er den Prozentsatz ersetzen soll.</>,
        ],
        notes: [
          { kind: "info", text: "Gezählt werden alle Teile im Warenkorb zusammen. Produkte mit Häkchen „Vom Mengenrabatt ausschließen“ (Tab Basis) zählen nicht mit." },
        ],
      },
    ],
  },
  {
    id: "gutscheine",
    title: "Gutscheine",
    icon: Ticket,
    to: "/admin/coupons",
    short: "Rabattcodes für die Kasse",
    why: "Codes wie SOMMER10, die Kunden an der Kasse eingeben.",
    blocks: [
      {
        steps: [
          <><b>Code</b> (3–30 Zeichen, A–Z, Ziffern, - und _), <b>Typ</b> % oder €, <b>Wert</b> eintragen.</>,
          <>Optional: <b>Min. Bestellwert</b>, <b>Max. Nutzungen</b> (leer = unbegrenzt) und <b>Gültig bis</b> (gilt bis 23:59 Uhr). Dann <Ui variant="primary">anlegen</Ui>.</>,
          <>In der Liste siehst du, wie oft ein Code genutzt wurde. Häkchen „aktiv“ weg = Code sofort abgeschaltet.</>,
        ],
        notes: [
          { kind: "info", text: <>Mögliche Hinweise in der Liste: <Tag cls="bg-amber-100 text-amber-800">inaktiv</Tag> <Tag cls="bg-amber-100 text-amber-800">abgelaufen</Tag> <Tag cls="bg-amber-100 text-amber-800">aufgebraucht</Tag></> },
          { kind: "info", text: "Der Rabatt gilt auf den Warenwert nach Mengenrabatt, nicht auf den Versand. Bei begrenzten Codes hält ein angefangener Bezahlvorgang eine Nutzung 20 Minuten lang fest. Wird ein Code trotzdem einmal zu oft eingelöst, bekommt die Bestellung einen Prüfhinweis." },
          { kind: "tip", text: "Statt einen genutzten Gutschein zu löschen, einfach „aktiv“ abwählen." },
        ],
      },
    ],
  },
  {
    id: "anfragen",
    title: "Anfragen",
    icon: ClipboardList,
    to: "/admin/inquiries",
    short: "Großbestellungen per Formular",
    why: "Hier landen Angebotsanfragen aus dem Formular „Großbestellung“ im Shop.",
    blocks: [
      {
        steps: [
          <>Anfrage anklicken – du siehst Kontaktdaten, Stückzahl, Textil-Art, Qualität, Druckverfahren und Bemerkungen.</>,
          <>Hat der Kunde ein Motiv mitgeschickt: <Ui icon={Download}>Motiv herunterladen</Ui>.</>,
          <>Antworten: Klick auf die E-Mail-Adresse öffnet dein Mailprogramm.</>,
          <>Status im Auswahlfeld setzen: <Tag cls="bg-secondary text-secondary-foreground">neu</Tag> → <Tag cls="bg-amber-100 text-amber-800">in Bearbeitung</Tag> → <Tag cls="bg-blue-100 text-blue-800">Angebot gesendet</Tag> → <Tag cls="bg-emerald-100 text-emerald-800">abgeschlossen</Tag></>,
        ],
        notes: [
          { kind: "info", text: "Die Zahl neben „Anfragen“ im Menü zählt die Anfragen mit Status „neu“. Zu jeder neuen Anfrage bekommst du eine Mail." },
          { kind: "info", text: "Motive werden aus Sicherheitsgründen nur heruntergeladen, nicht im Browser angezeigt." },
        ],
      },
    ],
  },
  {
    id: "bewertungen",
    title: "Bewertungen",
    icon: Star,
    to: "/admin/reviews",
    short: "Kundenbewertungen freigeben",
    why: "Kundenbewertungen erscheinen erst im Shop, wenn du sie freigibst.",
    blocks: [
      {
        steps: [
          <>Neue Bewertungen sind gelb hinterlegt und mit <Tag cls="bg-amber-200 text-amber-900">neu</Tag> markiert.</>,
          <><Ui icon={Check}>freigeben</Ui> = im Shop sichtbar. <Ui>verbergen</Ui> = wieder unsichtbar.</>,
          <><Trash2 className="inline h-4 w-4" /> = endgültig löschen (z. B. Spam).</>,
        ],
      },
    ],
  },
  {
    id: "nachrichten",
    title: "Nachrichten",
    icon: MessageSquare,
    to: "/admin/messages",
    short: "Kontaktformular und Newsletter",
    why: "Nachrichten aus dem Kontaktformular und die Liste der Newsletter-Abonnenten.",
    blocks: [
      {
        title: "Kontakt-Nachrichten",
        steps: [
          <>Auf die E-Mail-Adresse klicken, um zu antworten.</>,
          <>Danach <Ui icon={Check}>als erledigt</Ui> – die Nachricht wird blass und zählt nicht mehr im Menü.</>,
          <><Trash2 className="inline h-4 w-4" /> löscht endgültig – z. B. wenn jemand die Löschung seiner Daten verlangt.</>,
        ],
      },
      {
        title: "Newsletter",
        visual: <NewsletterDiagram />,
        steps: [
          <>Oben steht, wie viele Adressen bestätigt und unbestätigt sind.</>,
          <><Ui>Bestätigte als CSV</Ui> lädt nur die bestätigten Adressen – zum Import in dein Newsletter-Programm.</>,
          <><Trash2 className="inline h-4 w-4" /> = Abonnent entfernen (wie ein Klick auf „abmelden“).</>,
        ],
        notes: [
          { kind: "warn", text: "Schreib nur bestätigte Adressen an. Der Shop verschickt selbst keine Newsletter – er sammelt nur die Anmeldungen." },
        ],
      },
    ],
  },
  {
    id: "einstellungen",
    title: "Einstellungen",
    icon: Settings,
    to: "/admin/settings",
    short: "Versand, MwSt, Lieferzeit, Mail",
    why: "Grundwerte, die für den ganzen Shop gelten – Kasse und Rechnungen inklusive.",
    blocks: [
      {
        visual: (
          <Figure title="Die Felder">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {([
                ["Versandkosten (€)", "Pauschale je Bestellung."],
                ["Gratisversand ab (€)", "Ab diesem Warenwert (nach Rabatten) kostet der Versand nichts."],
                ["MwSt-Satz (0.19 = 19 %)", "Als Dezimalzahl: 0.19 für 19 %, 0.07 für 7 %."],
                ["Standard-Preis je Design-Element (€) für neue Produkte", "Nur die Vorgabe für neu angelegte Produkte – bestehende änderst du im Produkt."],
                ["Lagerwarnung unter (Stück)", "Dieselbe Warnschwelle wie unter „Bestand“."],
                ["Lieferzeit", "Pflichtangabe, steht auf jeder Produktseite. Format: „3–5 Werktage“, Zusätze nach einem Komma."],
                ["Benachrichtigungen an (E-Mail)", "Hierhin gehen Mails zu neuen Bestellungen, Anfragen, Kontakt-Nachrichten und Bewertungen."],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-xs leading-relaxed text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </Figure>
        ),
        steps: [
          <>Werte ändern und <Ui variant="primary">speichern</Ui>. Neben dem Knopf erscheint „Gespeichert.“</>,
        ],
        notes: [
          { kind: "warn", text: "Versandkosten, Gratisversand-Grenze und MwSt gelten sofort für Warenkorb, Kasse und neue Rechnungen. Schon erstellte Rechnungen bleiben unverändert." },
        ],
      },
    ],
  },
  {
    id: "passwort",
    title: "Passwort ändern",
    icon: KeyRound,
    to: SET_PASSWORD_PATH,
    short: "Eigenes Admin-Passwort",
    why: "Hier änderst du das Passwort, mit dem du dich im Admin-Bereich anmeldest.",
    blocks: [
      {
        steps: [
          <>Im Menü auf „Passwort ändern“ klicken.</>,
          <>Neues Passwort zweimal eingeben: mindestens 12 Zeichen, mit Buchstaben und Ziffern. Dann <Ui variant="primary">Passwort speichern</Ui>.</>,
        ],
        notes: [
          { kind: "tip", text: "Passwort vergessen? Auf der Admin-Anmeldung „Passwort vergessen?“ klicken – du bekommst einen Link per Mail." },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page

function GuideSection({ s }: { s: Section }) {
  return (
    <section id={s.id} className="scroll-mt-6 rounded-xl border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <s.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{s.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium text-foreground">Wofür? </span>{s.why}</p>
        </div>
      </div>

      <div className="space-y-6">
        {s.blocks.map((b, i) => (
          <div key={i} className="space-y-4">
            {b.title && <h3 className="border-t pt-5 text-base font-semibold">{b.title}</h3>}
            {b.visual}
            {b.steps && (
              <div>
                {!b.title && <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">So geht's</p>}
                <Steps items={b.steps} />
              </div>
            )}
            {b.notes?.map((n, j) => <Callout key={j} kind={n.kind}>{n.text}</Callout>)}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
        <a href="#inhalt" className="text-muted-foreground hover:text-foreground">↑ Inhalt</a>
        <Link to={s.to} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Zur Seite „{s.title}“ <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export default function Guide() {
  const { hash } = useLocation();
  // The page is lazy-loaded, so the browser cannot jump to #anchor on its own.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Anleitung</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Was jeder Bereich im Admin macht und wie du ihn benutzt – Schritt für Schritt. Die umrandeten Kästchen wie <Ui>speichern</Ui> sehen
            aus wie die echten Knöpfe, damit du sie wiederfindest.
          </p>
        </div>
      </div>

      {/* Quick start */}
      <div className="mb-8 rounded-xl border bg-muted/30 p-4">
        <p className="mb-3 text-sm font-semibold">Der typische Ablauf</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
          <FlowBox icon={Mail} title="Mail kommt">„Neue Bestellung PS-…“ landet in deinem Postfach.</FlowBox>
          <FlowArrow />
          <FlowBox icon={AlertTriangle} title="Prüfen">Prüfhinweis? Erst klären, dann „erledigt“.</FlowBox>
          <FlowArrow />
          <FlowBox icon={Package} title="Produzieren">„Design-Dateien (ZIP)“ laden, Status „in produktion“.</FlowBox>
          <FlowArrow />
          <FlowBox icon={Truck} title="Versenden">Sendungsnummer + „als versendet markieren + Mail“.</FlowBox>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Die Zahlen neben den Menüpunkten zeigen, wo Arbeit wartet: neue Anfragen, Bewertungen zum Freigeben, unerledigte Nachrichten
          und (gelb) knappe Größen. Sie aktualisieren sich jede Minute.
        </p>
      </div>

      {/* Table of contents */}
      <nav id="inhalt" aria-label="Inhalt" className="mb-10 scroll-mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inhalt</p>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent">
              <s.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.short}</span>
              </span>
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-8">
        {SECTIONS.map((s) => <GuideSection key={s.id} s={s} />)}
      </div>
    </div>
  );
}
