import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const KEY = "shirtshop-v2-cookie-consent";
export const CONSENT_EVENT = "shirtshop-consent-change";

/** True once the visitor allowed external content (Google Maps). */
export function hasExternalConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === "all";
  } catch {
    return false;
  }
}

function store(value: "all" | "essential") {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function grantExternalConsent() {
  store("all");
}

/**
 * Minimal DSGVO consent banner. Essential cookies only (Stripe payment, admin
 * auth) — no analytics/marketing. External content (Google Maps) loads only
 * after "all" consent; see ConsentMap. When tracking is added later, gate it
 * on hasExternalConsent() as well.
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
    store(value);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted-foreground">
          Wir verwenden nur technisch notwendige Cookies, damit Warenkorb, Bezahlung und Login
          funktionieren. Es findet kein Tracking statt. Mit „Alle akzeptieren“ erlaubst du
          zusätzlich das Laden von Google-Maps-Karten (Datenübertragung an Google). Mehr dazu in der{" "}
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
