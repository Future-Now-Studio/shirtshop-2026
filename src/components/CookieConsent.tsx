import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ps_cookie_consent_v1";

type Choice = "accepted" | "essential";

export function getCookieConsent(): Choice | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "essential" ? v : null;
}

export const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  const choose = (choice: Choice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    // Optional event other code can listen to (e.g. to load analytics on accept).
    window.dispatchEvent(new CustomEvent("cookie-consent", { detail: choice }));
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie-Hinweis"
      className="fixed inset-x-0 bottom-0 z-[100] border-t bg-background/95 backdrop-blur shadow-lg"
    >
      <div className="container-wide py-4 flex flex-col md:flex-row md:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          Wir verwenden technisch notwendige Cookies für den Betrieb des Shops (z.&nbsp;B.
          Warenkorb, Zahlungsabwicklung). Mit deiner Zustimmung nutzen wir zusätzlich
          Cookies für Statistik und Komfort. Mehr Infos in unserer{" "}
          <Link to="/datenschutz" className="underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => choose("essential")}>
            Nur notwendige
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Alle akzeptieren
          </Button>
        </div>
      </div>
    </div>
  );
};
