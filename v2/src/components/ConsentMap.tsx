import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CONSENT_EVENT, hasExternalConsent, grantExternalConsent } from "@/components/CookieConsent";

/**
 * Google Maps embed behind a two-click consent: the iframe (and thus any
 * request to Google) only loads after the visitor agrees, either here or via
 * "Alle akzeptieren" in the cookie banner.
 */
export default function ConsentMap({ src, title, className }: { src: string; title: string; className?: string }) {
  const [allowed, setAllowed] = useState(hasExternalConsent);

  useEffect(() => {
    const sync = () => setAllowed(hasExternalConsent());
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (allowed)
    return <iframe src={src} title={title} className={className} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />;

  return (
    <div className={`flex flex-col items-center justify-center gap-2 bg-muted/50 p-4 text-center text-xs text-muted-foreground ${className ?? ""}`}>
      <MapPin className="h-5 w-5 text-primary" />
      <p>
        Beim Laden der Karte werden Daten an Google übertragen.{" "}
        <Link to="/datenschutz" className="underline">Mehr erfahren</Link>
      </p>
      <Button size="sm" variant="outline" onClick={grantExternalConsent}>
        Karte laden
      </Button>
    </div>
  );
}
