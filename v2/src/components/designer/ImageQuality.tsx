import { dpiQuality, MIN_GOOD_DPI } from "@/lib/designer-print";

const LABEL = { good: "gut", ok: "eingeschränkt", low: "zu gering" } as const;
const CLS = {
  good: "bg-green-100 text-green-800",
  ok: "bg-amber-100 text-amber-800",
  low: "bg-destructive/10 text-destructive",
} as const;

const cm = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Print size + effective resolution of the selected image. */
export function ImageQuality({ dpi, cmW, cmH, estimated, vector }: {
  dpi: number;
  cmW: number;
  cmH: number;
  estimated: boolean;
  vector: boolean;
}) {
  const q = dpiQuality(dpi);
  return (
    <div className="mt-5 space-y-2 rounded-2xl border bg-card p-3 shadow-sm" aria-label="Druckqualität des Bildes">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bild · Druckqualität</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {vector ? (
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + CLS.good}>Vektorgrafik · gestochen scharf</span>
        ) : (
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + CLS[q]}>{LABEL[q]} · ca. {dpi} dpi</span>
        )}
        <span className="text-muted-foreground">Druckgröße ca. {cm(cmW)} × {cm(cmH)} cm</span>
      </div>
      {!vector && (
        <p className="text-xs text-muted-foreground">
          Für scharfe Drucke empfehlen wir mind. {MIN_GOOD_DPI} dpi. Je größer du das Bild ziehst, desto geringer die Auflösung
          {q !== "good" ? " – verkleinere es oder lade eine größere Datei hoch" : ""}.
          {estimated ? " Die Druckgröße ist anhand der Druckzone geschätzt." : ""}
        </p>
      )}
    </div>
  );
}
