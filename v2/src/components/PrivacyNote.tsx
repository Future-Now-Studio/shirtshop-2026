import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** DSGVO Art. 13 hint at the point of collection, linking the full privacy policy. */
export function PrivacyNote({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {children ?? "Wir verwenden deine Angaben nur, um deine Anfrage zu bearbeiten."}{" "}
      Mehr dazu in unserer <Link to="/datenschutz" className="underline hover:text-primary">Datenschutzerklärung</Link>.
    </p>
  );
}
