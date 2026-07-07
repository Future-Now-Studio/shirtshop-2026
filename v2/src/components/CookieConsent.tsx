import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const KEY = "shirtshop-v2-cookie-consent";

/**
 * Minimal DSGVO consent banner. The shop currently sets only essential cookies
 * (Stripe payment, admin auth) — no analytics/marketing. The banner records the
 * user's choice so it isn't shown again, and gives a clear decline option.
 * When tracking is added later, gate it on `localStorage[KEY] === "all"`.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* localStorage blocked — don't nag */
    }
  }, []);

  function choose(value: "all" | "essential") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Wir verwenden nur technisch notwendige Cookies, damit Warenkorb, Bezahlung und Login
          funktionieren. Es findet kein Tracking statt. Mehr dazu in der{" "}
          <Link to="/datenschutz" className="text-primary underline">Datenschutzerklärung</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("essential")}>
            Nur notwendige
          </Button>
          <Button size="sm" onClick={() => choose("all")}>
            Alle akzeptieren
          </Button>
        </div>
      </div>
    </div>
  );
}
