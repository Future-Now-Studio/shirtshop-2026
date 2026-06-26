import { ReactNode } from "react";

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-semibold">{title}</h1>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </div>
  );
}

function Placeholder({ what }: { what: string }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
      ⚠️ Platzhalter — {what} muss noch mit echten Inhalten gefüllt werden.
    </p>
  );
}

export function Unternehmen() {
  return (
    <Page title="Über uns">
      <p>
        Wir veredeln Textilien individuell — vom Einzelstück bis zur Großbestellung. Gestalte deine
        Kleidung selbst im Online-Designer oder lass dich in einer unserer Filialen beraten.
      </p>
      <Placeholder what="Unternehmensgeschichte, Team und Werte" />
    </Page>
  );
}

export function Leistungen() {
  return (
    <Page title="Leistungen">
      <ul className="list-disc space-y-2 pl-5">
        <li>Textildruck (DTG / Siebdruck) ab einem Stück</li>
        <li>Stickerei</li>
        <li>Eigener Online-Designer mit Druckzonen</li>
        <li>Großbestellungen mit Mengenrabatt</li>
      </ul>
      <Placeholder what="Detaillierte Leistungsbeschreibungen und Preise" />
    </Page>
  );
}

export function Filialen() {
  return (
    <Page title="Filialen">
      <p>Besuche uns vor Ort für persönliche Beratung.</p>
      <Placeholder what="Filialadressen, Öffnungszeiten und Karte" />
    </Page>
  );
}

export function Grossbestellung() {
  return (
    <Page title="Großbestellung">
      <p>
        Du brauchst viele Teile — für Verein, Firma oder Event? Mit steigender Stückzahl sinkt der
        Stückpreis automatisch (konfigurierbarer Mengenrabatt).
      </p>
      <Placeholder what="Anfrageformular und Staffelpreise" />
    </Page>
  );
}

export function Impressum() {
  return (
    <Page title="Impressum">
      <Placeholder what="Pflichtangaben nach §5 TMG (Anbieter, Adresse, Kontakt, USt-IdNr.)" />
    </Page>
  );
}

export function AGB() {
  return (
    <Page title="AGB">
      <Placeholder what="Allgemeine Geschäftsbedingungen (rechtlich geprüft)" />
    </Page>
  );
}

export function Datenschutz() {
  return (
    <Page title="Datenschutzerklärung">
      <Placeholder what="Datenschutzerklärung nach DSGVO (rechtlich geprüft)" />
    </Page>
  );
}
