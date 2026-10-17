/** Shown instead of the app when a real-mode build lacks its Supabase config. */
export function ConfigError({ missing }: { missing: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4 py-12">
      <div role="alert" className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-destructive">
          Das Portal ist nicht richtig konfiguriert
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Das Ballina B2B-Portal kann gerade nicht geladen werden, weil die Verbindung zur
          Datenbank nicht eingerichtet ist. Bitte versuchen Sie es später erneut oder wenden Sie
          sich an das Ballina-Team.
        </p>
        <div className="mt-4 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Hinweis für Administratoren</p>
          <p className="mt-1">
            Fehlende Build-Variablen: <code className="font-mono">{missing}</code>. In Netlify unter
            Site settings → Environment variables setzen und neu bauen. Der Demo-Modus wird nur
            mit <code className="font-mono">VITE_USE_MOCK=true</code> aktiviert.
          </p>
        </div>
      </div>
    </div>
  )
}
